# La carte des rouages

*Toutes les mécaniques du jeu, vues du bord du joueur : ce qu'il voit et fait, ce que chacune change, ce qui la change, et ce qui accroche. Lu dans le code le 3 octobre 2026 par quatre inventaires (repêchage et effectif ; alignement et match ; saison et décisions ; cartes, Rogue et méta). La page : https://claude.ai/artifact/Sw7WR6CVmMMorDC9t8Jx1J. La feuille de route qui en sort : docs/feuille-de-route-v2.md.*

169 mécaniques · 881 liens · 118 accrocs. Les numéros de ligne datent du 3 octobre : ils bougent avec le code.

## Ce qui accroche, de ton bord


### Le repêchage et l'effectif

- **case-alignement / position : le déplacement manuel ne vérifie pas le poste.** Le clic de permutation échange deux cases sans `fits` (js/alignement.js:342-356 ; alignement.js n'importe même pas `fits`). On peut donc poser un défenseur au centre, ou un gardien dans un trio (le patineur échangé part dans la case Partant). La pénalité vaut 999 (js/sim.js:458, 463, 471), chaque cote tombe au plancher 25 (sim.js:622-625), la case affiche « −999 » (alignement.js:256), et `pickGoalie` envoie au filet quiconque est dans la case G (sim.js:4974-4976). La destination auto (`openSlots`) et la fiche, elles, refusent ces cases.
- **zone : le chiffre affiché pour « au-dessus » n'est pas celui du moteur.** Il est faux dans l'infobulle « ▲ au-dessus de sa zone : −3 par cran, léger » (js/game.js:401) et dans la fiche (« −3 par cran », js/fiche.js:347). Le moteur fait 1,5 × cran² (1,5 / 6 / 13,5), multiplié ensuite par le nombre de mal placés (js/sim.js:185, 314, 348-352).
- **zone : « dans sa zone, il rend à plein » cache un bonus.** Une unité entièrement à sa place reçoit +2/+2 (js/sim.js:542-543). L'écran dit seulement « ✨ à leur place » et « le trio rend à plein » (js/alignement.js:426, 586).
- **position : les règles se trompent pour un ailier qui peut jouer centre.** Les règles disent « un ailier sur l'autre aile perd 2 » (index.html:455). Si son poste secondaire est C, le moteur lui donne −3 (`np === 'C' || sec === 'C'` → 3, js/sim.js:489-491).
- **position / zone : le poste secondaire est en partie inventé.** Aucun shard ne porte `secP`, donc le « / AG » affiché vient du faceoff (≥ 45 %) ou d'un hachage de l'id (~40 % des joueurs, js/ratings.js:660-684). Pourtant, il annule des pénalités, ouvre le loto (seuls les joueurs à 0 de pénalité, sim.js:111) et élargit la zone (T1-3/T2-4, ratings.js:698-708). Le joueur le lit comme un fait réel ; les règles ne le disent pas.
- **niveau / zone / badge : trois verdicts qui peuvent se contredire.** Ce sont trois mesures du même joueur : le niveau (points/match dans sa saison, js/niveaux.js:78), la zone (la cote cachée v, ratings.js:686) et le palier (score du rôle, toutes saisons, sim.js:1851). Un défenseur défensif peut lire « Soutien » + « 1re-2e paire » + « Défensif Or ». Le niveau, le plus en vue (pastille, ruban), ne compte pas du tout dans le moteur de match.
- **blessure / vestiaire-draft : un joueur qui a peu joué se blesse beaucoup plus, sans que rien ne le dise.** Le risque vaut 0,0015 + 0,015 × (1 − PJ réels/saison)² (js/sim.js:4811-4823) : un joueur à 20 PJ se blesse environ 8 fois plus qu'un joueur à 82. Aucune carte, aucune fiche, aucune règle ne le dit (index.html:446-475). Le prorata 82 matchs pousse même ces joueurs vers le haut des tris (game.js:943-951).
- **gardien-style : un style affiché et réglementé, que la saison ignore.** Les règles donnent un style au gardien (index.html:458) et la fiche écrit « son style dit comment il les fait » (fiche.js:68). L'archétype n'est lu que par sur-table (table.js:561, 650 ; aucune lecture dans sim.js). Même chose pour la zone de gardien : `zoneEcart` rend null pour un G (game.js:393).
- **gardien-rotation : la part des départs dépend des vrais PJ, et la carte n'en parle pas.** Un partant de 25 PJ jumelé à un auxiliaire de 60 PJ cède 50 % des départs (sim.js:4930-4935). La carte et la case ne montrent que le %ARR.
- **badge : la fiche montre l'effet brut, le moteur joue l'effet net.** La fiche affiche EFFET_ROLE × palier/4 (fiche.js:73), par exemple « −8 % » ou « 2,0 fois plus souvent ». Le moteur joue EFFET_ROLE × (palier/4 − moyenne de la ligue) (sim.js:1895-1899) : 7,6 %, 1,9×. Les joueurs SANS ce badge tirent l'unité un peu sous zéro, et ça ne se voit nulle part.
- **carrure : « 0,6 jambe » et « 1,8 jambes » sont des extrêmes.** La fiche et les règles (fiche.js:79-80, index.html:469) donnent ces deux valeurs. Le coût réel est continu, 1,2 × (1 + 0,5 × (1 − 2·physique)) (sim.js:1909) : environ 1,06 pour un « Costaud » au seuil 0,62. Autre écart : un joueur est costaud à 0,62 (gerant.js:138), une ligne à 0,56 (gerant.js:962).
- **nouveau:budget-du-choix / signature : la fiche contourne la confirmation.** Le bouton « Signer · {case} » de la fiche (fiche.js:342, 446-455) n'a ni « bloque la fin » ni confirmation, alors que la carte du bassin exige deux touchers (repechage.js:1291-1324). La fiche montre aussi la pénalité de base (`getPositionPenalty`, fiche.js:317), la carte celle du jour (`penaliteAffichee`).
- **« signables » a deux définitions.** Le tableau de bord et l'onglet comptent ceux qui tiennent dans le budget du choix (repechage.js:1010-1012). L'option « Signables seulement » filtre sur le plafond restant (repechage.js:1143-1146, index.html:339-340).
- **salaire / plafond : « x % du plafond » se calcule toujours sur 95,5 M$.** `pctCap` divise par CAP (game.js:68, 968), même en Express (34 M$) et en Rogue (82 M$).
- **salaire / plafond : en « Valeur époque », la jauge mélange les époques et les dollars.** Le restant est converti dans l'époque du club de la roulette, mais posé sur le plafond complet de cette saison, même en Express (repechage.js:830-841). Le budget du choix et la confirmation restent en dollars 2026 (repechage.js:1050, 1321), alors que la carte montre le salaire d'époque (game.js:965).
- **plafond / contrat : en saison classique, la jauge oublie le plafond effectif.** Le montant restant suit le plafond effectif (game.js:367), mais l'étiquette et le remplissage restent sur MODE().cap (repechage.js:841, 846). Une carte qui déplace le plafond fait donc mentir la jauge. Le Rogue, lui, l'affiche bien (rogue-jeu.js:56).
- **age-recrue : le ruban et l'effet ne suivent pas le même critère.** Le ruban « Recrue » suit la vraie saison recrue (`p.rk`, repechage.js:48, 573). L'effet « 🐣 Le jeune progresse » suit le contrat d'entrée (`p.elc`, repechage.js:98 ; rarete.js:101), qui dure jusqu'à 3 saisons. Une recrue d'avant 1995 a le ruban sans l'effet ; un joueur en 2e année d'ELC a l'effet sans ruban, et la gemme le cache (cartes.js:273).
- **variante / position : le bonus Polyvalent n'est pas montré au repêchage.** `_carte` n'est posée qu'au lancement de la saison (banc.js:646), donc la carte affiche « −3 hors position » sans le Polyvalent (−18/−30 %) que la même carte montre déjà en bonus (sim.js:604).
- **adaptation-case : les règles disent « à la même case », le moteur compte par rôle.** Les règles (index.html:455) parlent de 15 matchs « à la même case ». Le compteur est tenu par rôle de case (`_adapt[s.role]`, sim.js:2326) : un centre adapté à l'AG du 4e trio garde son adaptation au 1er trio.
- **relances : « Autre année » garde le club, et l'écran ne le dit pas.** L'infobulle dit « Retirer une autre saison au hasard » (repechage.js:955), mais la relance garde le même code de club quand il existe (repechage.js:755-756 avec nextSpin(true,false)). Le commentaire du code dit même le contraire (repechage.js:726). En mode « Une saison », « Passer » et « Autre équipe » font la même chose.
- **vestiaire-draft : « À combler » n'est pas la case où va la signature.** En Vestiaire, le tableau de bord affiche « À combler : 1er trio · AG » (`nextNeed`), mais le joueur signé va à SA meilleure case (destinationFor/slotFitScore, game.js:378-384) tant qu'on ne vise pas.
- **renfort / origines : l'Express offre des lignes d'origine gratuites.** Les 17 renforts sortent d'un seul club-saison (game.js:2375-2386). Les trios 2-4 et les paires 2-3 portent donc presque toujours « 🧩 Ligne d'origine » (sim.js:1557), qui paie les cartes de club (index.html:480), sans que tu aies rien bâti.
- **vocabulaire : un mot pour plusieurs idées.**
- « relance » nomme le reroll de la roulette (repechage.js:956-960), la sortie de zone en défense (« Paire de relance », sim.js:1515 ; « 💨 Relance rapide », index.html:462) et le reroll de dés sur table (index.html:335).
- « Recrue » nomme le ruban rookie et le niveau de l'IA sur table (index.html:335-336).
- Les règles appellent « trophée » ce que le code et CLAUDE.md appellent « trait » (index.html:457), et une réputation (⚡ Vitesse) porte « — Lauréat » dans son infobulle (game.js:1036-1039).
- La zone se dit « 1er-2e trio » sur la carte (zoneTag non-mini, repechage.js:1262) et « T1-2 » dans la case et les règles.
- La zone de profondeur D s'appelle « Réserve D » / « rés. » (ratings.js:634) : la case vide de la 3e paire lit « P2 · P3 · rés. », alors que « Réserve D » est aussi le nom d'une case de réserviste (sim.js:383).
- **icônes : une icône, plusieurs sens.** Ça viole la règle « une icône = un sens ». Les identités 🎯 / 🦍 / 🧱 / 🪄 / ⚡ / 🐣 (identites.js:42-60) reprennent l'icône du badge Sniper, du badge Power forward, du trait Norris, du trait Créateur, du trait Vitesse et de « Le jeune progresse ». Sur la carte du bassin, l'étiquette d'identité est collée au badge (repechage.js:1262). Le trait 🥊 Colosse et le style d'équipe 🥊 Robuste, ainsi que 🧱 Norris et le style 🧱 Défensif, se partagent aussi une icône (sim.js:2522-2524).
- **zone (règles) : la liste des zones est incomplète.** Les règles donnent T1, T1-2, T2-3, T3-4, T4 ; P1, P1-2, P2, P3 (index.html:454). Les cartes montrent aussi T1-3, T2-4, P1-3, P2-3, « rés. » et les zones de gardien (ratings.js:619-640, 701-706).
- **Les règles taisent le fonctionnement du loto et des retraits.** L'échelle du loto, la dette de tour (✕ ne refait pas tourner), le nombre de relances du Loto (2), l'identité de départ et les variantes de carte sont absents de la page des règles (index.html:446-448). Le joueur ne les découvre que par des toasts ou pas du tout.

### L'alignement et le match

- consigne vs défense : la règle dit « Basse penche défense » (index.html:471) et le plan « vedette » se contre par « la consigne Basse, qui penche défense » (js/sim.js:7189). Mais au moteur, Basse donne défense 1,02 × (1 − 0,02) = 0,9996, soit ±0 (js/sim.js:2064, 2989). L'écran filtre « ±0 % » (js/gerant.js:911) : Basse ne montre donc que Précision −5 % et Usure −20 %.
- gros-match, consigne, agressivite : contrer « matraquage » (2 lignes en Basse) ou « vedette » (consigne Basse) ne fait que lever le drapeau `gros.contre` (js/sim.js:7202-7210, 7523). Ce drapeau n'est lu nulle part dans le moteur, alors que le contre par système est réel (action spéciale étouffée).
- systeme, trio-fermeture, nouveau:appariement : « En face » compare ton trio u au trio adverse de même rang (js/gerant.js:728-739). Le moteur, lui, envoie la fermeture adverse (le 3e) contre ton 1er trio 40 % des présences (js/sim.js:4407-4424). Le conseil « pour l'étouffer » vise donc souvent la mauvaise unité.
- fit vs badge, et « maîtrise » : le fit lit `stylesDe`, à talent égal (js/sim.js:1463-1483). La case montre le badge `profilsDe` (« Sniper Or »), si bien qu'un Sniper Or peut recevoir ✗ au poste sniper. La règle dit « c'est leur maîtrise de ce rôle qui compte » (index.html:463). Or « maîtrise » veut dire trois choses : le score de rôle de la fiche (index.html:452), le 📘 maîtrise des systèmes (`_maitrise`) et `maitrise()` = badge centré (js/sim.js:1895).
- glace : la règle annonce 30/26/23,5/20,5 % (PART_UNITE, index.html:465). L'écran calcule « ≈ mm:ss à forces égales » sur POIDS_TRIO 34/28/22/16 (js/gerant.js:691-695, js/ratings.js:356), sur 60 minutes et non sur les minutes à forces égales. Il ignore aussi roulement, moments et coachs (js/sim.js:1285).
- systeme (Hourra), chimie, action-speciale : coûts cachés. Une chimie sous 26 donne un bonus NÉGATIF (js/sim.js:4784-4787), et tous les lancers à forces égales prennent ×0,88 SPEC_NORME (js/sim.js:4666), si bien qu'une ligne en Hourra ou à chimie basse finit sous la norme. L'écran dit seulement « rien à assortir » ou « naissante ».
- systeme : la règle dit « chacun en étouffe un autre » (index.html:463), mais 🧲, 🧰 et 🌗 ont `bat: null` (js/sim.js:1650, 1656, 1692). Aucun système n'a `bat: 'energie'`, donc 🧰 Trio de plombiers ne peut jamais être étouffé.
- agressivite : effets cachés. Elle change les jambes adverses par les coups (js/sim.js:1927), le nombre de bagarres et mêlées (js/sim.js:1995-2000) et la robustesse d'équipe (robTac, js/sim.js:4085 → K_ROB et dissuasion). Les boutons ne montrent que Défense, Punitions et Usure (js/gerant.js:984-987, 1109-1112).
- agressivite (défaut) : le bouton Moyenne est étiqueté « Par défaut » (js/gerant.js:983, 1105). Or une ligne jamais réglée joue `meilleureAgressivite` pour sa carrure (js/sim.js:2204), qui peut être Haute ou Basse.
- discipline, carrure : « une ligne légère prend plus de punitions », avec une puce « Punitions +N % » par ligne. Pourtant le puni est tiré parmi TOUS les patineurs selon leurs PIM réels (js/sim.js:5365), et le surplus est moyenné sur la présence (js/sim.js:4084, 4088).
- carrure, coups : « 0,6 à un costaud 🪨, 1,8 à un léger 🪶 » (index.html:469) sont les extrêmes, à physique 1 ou 0 (js/sim.js:1909). Un 🪨 au seuil 0,62 (js/gerant.js:138) paie environ 1,06.
- robustesse vs carrure : « habille tes joueurs les plus robustes » (js/saison.js:2753, js/banc.js:545). K_ROB, la dissuasion et les blessures lisent la cote `r` cachée (js/sim.js:3563, 4822, 4908), alors que la seule mesure visible, 🪨, lit `mr`, le gabarit et Colosse (js/sim.js:1777-1781).
- nouveau:dos-a-dos, blessure : le 🥵 ne parle que de robustesse. Le même soir, les blessures montent ×1,5 (js/sim.js:4820) et la récupération tombe à environ 26 % (js/sim.js:2400), et rien ne le dit.
- nouveau:jambes-gardien : les boutons du filet réutilisent `jambesHtml` (js/gerant.js:939-944). Son infobulle donne la règle des patineurs (0,5 %/point, +3 % à 100, blessures sous 60, js/gerant.js:658). Or un gardien perd 1 % de buts accordés par 5 points, avec un plancher de 40 (js/sim.js:3833-3839).
- nouveau:coup-marquant, coups : au direct, le coup marquant s'appelle « MISE EN ÉCHEC » (js/direct.js:527), alors que la ligne « Mises en échec » des stats compte les coups attendus (js/direct.js:393) : deux nombres sous un même nom. Les −2 jambes et le ×1,5 de blessure ne sont jamais montrés. De plus, les jambes sont retirées avant les lancers (js/sim.js:5330, 2015), donc avant l'instant du coup.
- bagarre : les −8 jambes aux deux combattants (BAGARRE_JAMBES, js/sim.js:1969, 2035) ne figurent ni dans la règle ni au direct. Les +6 % de finition pendant 10 min ne sont pas dits au fil (js/direct.js:530-538).
- Collision de mots : « élan » désigne la mana des cartes (CLAUDE.md:170), la bagarre (ELAN_BAGARRE) et « 🔥 L'élan » après un gros match (js/sim.js:7801).
- trio-fermeture : retoucher le 🔒 met la fermeture à `null`, pas à « auto » (js/alignement.js:471). Il n'y a alors plus aucun plan d'appariement (js/sim.js:4092), et la note « Par défaut c'est le 3e trio » disparaît (js/banc.js:552).
- nouveau:derriere-le-banc : vestige du plan de match. Le bouton dit « avec ces trios, ce plan et cette glace » (js/banc.js:554) et `G.banc.plan` est rempli (js/banc.js:96), mais PLANS n'est plus lu par le moteur (js/bilan.js:696, js/sim.js:1258). Les écouteurs `.banc-seg-btn` sont branchés sans aucun bouton (js/banc.js:564-571).
- roulement : il ne s'atteint que par « Les ménager », où il n'est présenté que par son prix (js/saison.js:2261). Ses effets sur blessures et robustesse n'entrent pas dans les totaux du soir (js/sim.js:6793-6813), et son déplacement de minutes n'apparaît pas dans les mm:ss.
- nouveau:preparer-match : les totaux du soir ne couvrent que tirs, précision, buts contre et punitions (js/sim.js:6809-6813). La règle promet « le total du soir par effet » (index.html:484), mais les Blessures +25 % de Haute, l'usure, la robustesse, les systèmes, les badges, la chimie et les jambes n'y sont pas : l'affiche peut dire « aucun effet ».
- avantage-numerique : les unités sont choisies seules, sur des stats réelles (js/sim.js:3909-3944). Le joueur n'a aucun réglage, et la page des règles n'a aucun paragraphe AN.
- nouveau:prolongation : elle se décide sur la cote cachée `c` et le trait Meneur (js/sim.js:5251), sans lancers. C'est invisible, alors que la règle dit « aucune cote ne s'affiche… un joueur se juge sur ce qu'il a fait ».
- consigne vs agressivite : le mot « Basse » nomme deux réglages (🕊️ agressivité, 😌 consigne). La paire « Hourra » s'appelle « Sans consigne » (js/sim.js:1664), et l'affiche dit « L'importance de ce match » (js/saison.js:2669) là où l'écran dit « Consigne du match ».
- Une icône = deux sens : 🔥 désigne à la fois Échec avant 2-1-2 (js/sim.js:1619), L'élan (7801), Quatre victoires de suite (2900) et l'entracte « Doubler le 1er trio » (7428). 🧱 désigne à la fois le trait Norris, « 🧱 DÉFENSE » au direct (js/direct.js:453), le style Défensif (js/sim.js:2523) et « Fermer la porte » (7435). L'échec avant adverse est 🐺 (js/sim.js:7183) mais le tien est 🔥.
- jambes : le surplus au-dessus de 100 (réserve jusqu'à 30, js/sim.js:2411-2419) ne se voit nulle part, puisque la barre plafonne à 100.
- Doc seulement : MOTEUR.md:368-373 donne encore EFFET_ROLE à 6/3/5 % et plombier −15 %. Le code et la règle disent 8/4/6/8 % et −40 % (js/sim.js:1858, index.html:468).

### La saison et ses décisions

- **elan / gros-match / deck-match : « élan » a trois sens.** L'élan, c'est la mana des cartes (« 3 d'élan », js/combat.js:37, js/gerant.js:1386). « 🔥 L'élan », c'est aussi la récompense d'un gros match gagné (finition +3 % pendant 3 matchs, js/sim.js:7801). Et « 🌊 L'élan » est une carte de match (js/combat.js:211). Le bandeau du gros match met les deux premiers côte à côte : « Victoire : 🔥 L'élan… » (js/saison.js:2693) contre « 3 d'élan par main » (2037, 1056).
- **gros-match / malediction / cicatrice : « Rivalité » ne veut pas dire la même chose partout.** À l'écran, MINI_BOSS.nemesis s'appelle « Rivalité » (2 défaites contre le club, js/sim.js:7799). « Ta rivalité » dans Ton histoire, c'est le club le plus croisé en gros match (js/saison.js:182-191, 2116). La page des règles dit « ta némésis » (index.html:479). La carte du doute dit « ta rivale » (js/combat.js:302). Les règles disent aussi « gros match », alors que l'écran dit « Combat » (js/saison.js:2688 ; badge js/gerant.js:296), la route « match important » (js/saison.js:2136) et les séries « boss ».
- **main-journee / calendrier : le palier s'appelle « La main de la journée 20 » (js/saison.js:2461, 3050), mais 20 est un numéro de MATCH.** PALIERS_CARTES est en matchs (js/sim.js:3012 ; règles index.html:481 : « 20e, 40e, 60e matchs »). Partout ailleurs, « Journée » est le jour du calendrier sur ~186 (js/saison.js:2628).
- **objectif-proprio / malediction : un objectif raté ajoute aussi « La distraction » au deck (js/combat.js:385-386), et personne ne le dit.** Le verdict ne parle que des vols nolisés (js/saison.js:2904-2907), la puce avant le choix pareil (2925), et les règles aussi (index.html:481). Les règles annoncent « deux malédictions au plus », mais ce plafond ne vise que les cicatrices (js/combat.js:402-405) : la distraction s'ajoute sans limite.
- **cicatrice / blessure / gros-match : l'écran se tait au moment où une cicatrice naît.** Le message d'une blessure de 15 matchs et plus ne parle pas de la blessure qui traîne (js/saison.js:3076-3086). Le bandeau et le sommaire d'un gros match perdu contre la rivalité ne parlent pas du doute (2693, 1692).
- **gros-match / nouveau:avant-match : la durée de l'élan est figée à 3 à l'écran.** Le bureau écrit « pour trois matchs, et les partisans montent / les médias s'acharnent » (js/saison.js:2003), le sommaire et le bandeau disent 3 (1692, 2693). Pourtant une garantie ou une chanson double la durée (js/sim.js:7843-7846). Et « partisans / médias » sont des factions supprimées en S72 (js/sim.js:2976) : l'écran annonce un effet qui n'existe plus. La garantie promet aussi « une victoire vaudra double » (js/sim.js:7304) alors que seule la durée double.
- **deck-match / main-adverse : en saison normale, l'aperçu de la main n'affiche pas ce que le moteur jouera.** La main reçoit toujours echelleTardive (×0,5 à ×1,5, et ×1,6 à ×2 en séries) (js/saison.js:1059-1061, 3787-3788). L'aperçu affiche « 📈 … vaut ×N » et échelonne les chiffres (js/gerant.js:1356-1359). Le moteur, lui, applique 1 hors du Rogue (js/sim.js:7497, 6365-6366). Dans le même soir, le bandeau du dépistage montre leur main sans échelle (js/saison.js:2692) : deux chiffres différents pour les mêmes cartes.
- **elan / calendrier : les règles disent « 4 d'élan à partir du 55e match » (index.html:478 ; MATCH_ADVERSE_FORT, js/combat.js:491), mais le code compte en jours.** Il passe à 4 au jour 125 (js/combat.js:492-495), alors que la règle de la 1.0 est que les dates se comptent en matchs du club (js/saison.js:794-799 ; js/sim.js:5802-5809).
- **nouveau:conseils / consigne : le conseil « 🎯 Consigne : attaque / 🛡️ défense » pose {importance:'normale', ad:±2} (js/pronostic.js:414-420).** Ni l'interface ni les règles ne connaissent ce réglage : elles parlent d'un seul réglage Basse/Normale/Haute, avec ad lié (index.html:471 ; js/sim.js:2069-2076). L'affiche montre « 🎚️ Normale » (js/saison.js:2666-2669). Rouvrir « Préparer le match » recalcule ad à partir de l'importance (js/gerant.js:836), donc « Appliquer » efface le conseil sans prévenir. L'affiche dit « importance » (title, 2669) là où les règles disent « consigne ».
- **nouveau:preparer-match / series : en séries, « Préparer le match » s'ouvre sur Haute (js/saison.js:3738), alors qu'en saison c'est « Normale par défaut, même un gros match » (js/saison.js:2812-2813).** Appliquer en séries sans y toucher met donc la consigne à Haute (blessures +25 %, usure +12 %) sans que le joueur l'ait choisie. Le gerant affiche en plus « 🌡️ Haute conseillée » en gros match (js/gerant.js:912), ce que les règles ne disent pas.
- **jambes / nouveau:conseils : le conseil dit « Sous 90, un joueur rend un peu moins à chaque point » (js/pronostic.js:405) ; le moteur et les règles disent 94 (ENERGIE_REF, js/sim.js:2398 ; index.html:474).** Le conseil se déclenche sous 88 (js/pronostic.js:402).
- **calendrier / dilemme / situation / accident : la route et le calendrier promettent des choses qui peuvent ne pas arriver.** Ils posent ❓ à chaque jour de JOURS_MOMENTS (js/saison.js:581, 2173), mais un dilemme ne se tire que si ses faits sont vrais (js/sim.js:2873 ; js/saison.js:904-905) et attend le lendemain d'un gros match (js/saison.js:900). Les 💬 restent au jour prévu même quand la situation est reportée (js/sim.js:5997-6001). Les accidents (js/sim.js:6619) n'apparaissent ni sur la route ni dans les règles, et le verdict du proprio n'est pas marqué.
- **de / deck-match / nouveau:ajustement-serie : un même pari s'affiche de trois façons.** Pour un dilemme ou un avant-match, c'est un dé à 6 faces avec sa scène (js/gerant.js:388-440). Pour une carte, c'est « 🎲 50 % » tranché par hacherMise (js/gerant.js:1254 ; js/sim.js:7655). Pour l'ajustement « Un coup de dés », c'est juste « 🎲 Pari », sans dé ni message de résultat (js/gerant.js:1383 ; js/sim.js:7076). Le message « le pari a payé » ne lit que les paris des décisions (js/saison.js:3141-3148).
- **boite / main-journee / dilemme : « Plus tard » ne repousse rien.** Le bouton existe sur le palier et sur les événements (js/saison.js:2461, 2895), mais le message bloque toujours « Journée suivante » (bloque : true, 3050 et 3000 ; 3197-3198). Le commentaire, et la règle de CLAUDE.md « un palier n'arrête l'avance qu'une fois », disent qu'un palier ne bloque rien (js/saison.js:776-781). La page des règles ne dit pas non plus que la boîte bloque.
- **rejouer / historique / nouveau:decision-datee : « rejouer » nomme trois choses.** « Rejouer la saison » = mêmes clubs, autres dés (js/bilan.js:851). « Rejouer » de l'historique = nouveaux clubs (js/game.js:2244, 2413-2416). Et « On rejoue la saison avec ton choix » = la reprise d'une décision (js/banc.js:258). Le titre « les mêmes 31 clubs » est faux en mode Une saison, où la ligue compte 21 à 32 adversaires (js/banc.js:624-629).
- **coach / boite / entracte : « coach » a deux sens.** Dans la boîte, c'est « 🧑‍🏫 L'entraîneur » (clé coach, js/saison.js:2845). Il y a aussi « Le coach élève la voix » à l'entracte (js/sim.js:7425), la carte « Le coach dans leur tête » (js/combat.js:178) et la carte de saison « Le coach des gardiens » (js/sim.js:~1109). Or dans le vocabulaire, « coach » = une des 9 philosophies, celles de « 📋 Tes coachs » (js/saison.js:2586).
- **series / nouveau:ajustement-serie / adjoint : la page des règles décrit le match de séries par « sa main, son dépistage et un choix au deuxième entracte » (index.html:487).** Elle omet l'ajustement obligatoire dès le match 2 (js/saison.js:3760-3766) et la délégation à l'adjoint, qui choisit « garder » à tous les entractes sans le dire (3648-3652).
- **main-journee : les règles annoncent « un effet, un vrai joueur, une amélioration, un stage » (index.html:481).** Le code a 8 sortes, dont le ménage, le camp, l'atelier et le nouveau rôle (js/sim.js:3023-3035, 3069). Le texte de l'amélioration dit « s'améliore pour de bon » (SORTES_DECK, js/sim.js:3026) alors qu'elle part à l'inventaire et ne joue qu'une fois posée (js/saison.js:2502 ; js/banc.js:213).
- **nouveau:case-vide / carte-saison : la carte tirée sur une case vide n'est pas dans les règles (index.html:477-481).** Elle peut nuire (tout bonus a son malus), et l'écran n'offre que « Compris » (js/saison.js:3043).
- **situation : l'écran ne dit ni la durée ni la force.** La situation dure jusqu'à la fenêtre suivante (js/sim.js:3411-3416, 3429) et le pesé est amplifié ×1,3 (js/sim.js:3207), mais le message n'en dit rien (js/saison.js:3112-3126). « Jusqu'à la prochaine décision » ne garde que la dernière situation croisée (js/saison.js:1733-1746).
- **nouveau:avant-match : « Le retour de l'ancien » affirme « Un joueur que tu as laissé partir joue chez eux » (js/sim.js:7355-7356) sans vérifier les faits.** C'est contraire à la règle des dilemmes, qui ne se tirent que si le fait est vrai (js/saison.js:908-915).
- **nouveau:ligue-ecrans / series : les règles disent « le classement général décide, aux victoires puis au différentiel » (index.html:487).** L'écran trie aux points, puis V, diff, BP (js/saison.js:720 ; js/sim.js:6098-6099). Et le rang qui désigne un « rival » de gros match se prend sur PTS puis V seulement (js/sim.js:6016) : deux ordres pour le même mot « rang ».
- **trophees / trait : les mêmes noms ont deux sens.** Selke, Norris, Vézina sont des « trophées » de joueur, donc des traits (index.html:457). Le bilan dit « Le Hart, le Norris, le Selke et le Vézina sont des votes : le moteur n'a pas d'électeurs » (js/bilan.js:200).
- **bilan : l'infirmerie apparaît deux fois (js/bilan.js:785 et le carton « Santé », js/entracte.js:261), et les tranches de 10 matchs aussi (js/bilan.js:604-610 et js/entracte.js:235).** C'est contraire à la consigne « jamais dédoubler ».
- **nouveau:retour-blesse : « Remettre comme avant » restaure aussi la fermeture et les lignes de la décision d'avant la blessure (js/saison.js:3290).** Cela peut écraser en silence des lignes ou une consigne réglées depuis.

### Les cartes, le Rogue, la méta

- **repechage-rogue / plombiers-depart / boutique.** Le repêchage promet « Les cases vides recevront des plombiers de la ligue » (js/rogue-jeu.js:1290), mais `choisirNouvelleEquipe` fait seulement `autoRoster(gardes + classeur + repêchés)` et ne comble aucun trou (1301-1309). Avec « Passer le repêchage », l'équipe a des cases vides. La saison refuse alors de partir (js/banc.js:591). En Rogue, une case vide renvoie à la boutique (js/alignement.js:361-362), qui est fermée avant la saison (js/game.js:1899). C'est un blocage possible.
- **plombiers-depart / repechage-rogue / mandat.** Les règles et le bilan promettent « 3 Soutien de moins par saison » et « le reste vient de ton classeur, avec moins de Soutien » (index.html:490 ; js/rogue-jeu.js:1041). Or le parcours v2 passe toujours `rosterExterne` : `vestiaireDeDepart` et son quota ne tournent plus (1317-1322), et le repêchage offre des Réguliers de 35 à 70 % (1257).
- **variante / repechage-rogue.** Le repêchage montre chaque recrue en carte de base (`rar || 'commune'`, js/rogue-jeu.js:1287). Mais `continuerRun` ne pose une variante que pour le classeur (1322). En jeu, la recrue prend donc une variante tirée à 25 % brillante (js/repechage.js:85). L'écran et le moteur ne disent pas la même chose.
- **classeur / nouveau:gardes-de-saison / repechage-rogue.** Trois budgets, trois formules, trois noms : « 📒 Budget du classeur » (−45 M$ de plombiers, + prestige), « 🤝 Budget des gardés », « 💰 Budget restant » (sans les −45 M$ ni le prestige) (js/rogue.js:146 ; js/rogue-jeu.js:1211, 1280). Au départ d'une run, les gardés ne réduisent pas le budget du classeur (776) ; à la saison suivante, oui (1211). La ligne fixe « avec la place pour tes plombiers » s'affiche aussi au repêchage (js/depart.js:96).
- **nouveau:pitie.** L'écran dit « 8 packs d'affilée sans holo ni or, et le suivant en a une », donc le 9e (js/magasin.js:111 ; js/packs.js:29-31). Le code garantit le 8e (`packsSansHolo >= PITIE - 1`, js/rogue-jeu.js:258). Décalage d'un pack.
- **evenement-carte / consommable.** Le coin de la carte dit « N journées » (js/inventaire.js:86, et le commentaire de js/banque.js:231), alors que ses puces disent « N matchs » (js/sim.js:6708) et que le moteur compte en matchs (`apresMatchs`, js/sim.js:5597).
- **nouveau:pack-palier / main-journee.** Le pack Mixte gratuit tombe aux JOURNÉES 20, 40 et 60, soit vers le 9e, le 18e et le 26e match (js/inventaire.js:33, 53), avec la source « Main de la journée 20 ». Les règles parlent des « mains des 20e, 40e et 60e matchs » (index.html:481), et `PALIERS_CARTES` a été converti en matchs (js/saison.js:794-801). Ce pack gratuit n'est écrit nulle part dans les règles.
- **classeur / cartable / nouveau:classeur-banque.** « Le classeur » veut dire deux choses : les cartes de joueurs (« les autres vont à ton classeur », js/magasin.js:122 ; js/depart.js) et l'onglet de la banque de cartes de jeu (js/inventaire.js:118, 185). Ce même onglet situe le cartable à « l'onglet Vestiaire » (185 ; js/cartable.js:9), alors que la section s'appelle Collection et la page « Ton cartable » (index.html:280-282).
- **« vestiaire ».** Le mot sert à cinq choses : le bassin du repêchage, « Le vestiaire des déblocages », « Ton vestiaire : N Soutien… » (js/rogue-jeu.js:803), « Ton vestiaire » à l'écran Ta run (1099), et « le vestiaire croit à lui » de la confiance (js/inventaire.js:168).
- **ecussons / club-cosmetique.** « Écussons 🏅 » est la monnaie, et « L'écusson » le logo du club. 🏅 sert aussi d'icône au rayon « Ton club » et à son écran (js/magasin.js:99 ; js/rogue-jeu.js:1398, 1436). Une icône et un mot pour deux sens.
- **plombiers-depart / trait (plombier 🪠) / systeme.** CLAUDE.md définit « plombier » comme le rôle 🪠. Le Rogue appelle « plombiers » les 23 joueurs faibles du départ (js/rogue-jeu.js:589-617). Les joueurs-rôle plombier sont « Joueurs du Doc » (`energie` → `souffle`, js/coachs.js:66), et 🧰 « Trio de plombiers » est le système du Contremaître (js/sim.js:1655-1657).
- **repechage-rogue.** Le Rogue a désormais « Le repêchage » (js/rogue-jeu.js:1289), mais le code et l'écran disent encore « le Rogue ne repêche jamais » (js/cartable.js:10) et « Le Rogue n'a pas de vestiaire où piger » (js/alignement.js:361).
- **contrat / modif-joueur.** Il y a deux familles « contrat » : CATEGORIES.plafond.un « Contrat » et le Pack Contrats 💵 d'un côté, les MUTATIONS de source `contrat` (contrat_annee…) rangées dans « Modifs de joueurs » de l'autre (js/banque.js:41, 44, 371-377).
- **coach / adjoint.** Le patron de rôle « Entraîneur-chef » (js/banque.js:52) et l'événement « Le coach sort de ses gonds » (257) ne sont pas des coachs au sens de « Ton coach ».
- **nouveau:depisteur-du-coach / couleur.** Le dépisteur ne recrute pas la couleur de son coach. Le Frelon recrute `rapides` = profil(energie, manieur) (js/identites.js:51-53 ; js/packs.js:325), c'est-à-dire des joueurs du Doc et de l'Abbé (js/coachs.js:66-67). Le Doc recrute la jeunesse, le Contremaître et le Comptable recrutent des aubaines, l'Abbé des joueurs peu punis : aucun de ces scores ne lit la couleur du coach.
- **confiance (II) / systeme / couleur.** Le système qu'apprend la confiance II ne demande pas les joueurs de la couleur du coach (js/coachs.js:105-125 ; js/sim.js:1618-1660). L'Aigle (sniper) apprend le Jeu d'enclave (power/passeur/power). Le Rhino (bagarreur/physique) apprend l'Échec avant (power/energie/checker). L'Abbé, dont seuls les défenseurs manieurs ont la couleur, apprend Cycle et possession, un système de trio d'avants.
- **confiance / coach.** Au départ, « Tes coachs » affiche « 3 cartes jouées » pour ton coach alors qu'aucune n'a été jouée : c'est `coachsDeBase: 3` (js/banc.js:644 ; js/inventaire.js:176).
- **confiance / couleur.** Les coachs agissent dans tous les modes (palierAllume dans js/banc.js:211 ; `coachs` dans js/banc.js:777), mais les règles ne les décrivent que dans « Le mode Rogue » (index.html:491).
- **nouveau:doublon / cartable.** Dans un pack, « doublon » veut dire déjà tiré d'un pack (`meta.collection`, js/rogue-jeu.js:260-263). Le cartable compte comme doublon toute copie de plus, y compris un joueur repêché ou aligné (js/cartable.js:52-66, 158). Un joueur déjà au cartable peut donc ne pas être un doublon dans le pack.
- **nouveau:classeur-banque / album / deck-match.** On ne peut jamais compléter la banque : seules les cartes tirées d'un pack comptent (js/rogue.js:325 ; js/rogue-jeu.js:384), alors que les malédictions et les cartes de saison n'en sortent jamais (js/packs.js:438 ; PACKS_CARTES sans `saison`), et elles figurent quand même au dénominateur (js/inventaire.js:184). L'album compte les cartes de match autrement, par le deck final de l'historique (js/album.js:28), et dit « Celles qui manquent se gagnent dans les gros matchs et les séries » (79), sans parler des packs.
- **album / cartable.** L'en-tête de l'album « N joueurs au cartable » compte l'historique (js/album.js:75), pas le cartable (js/cartable.js:214).
- **nouveau:moments-legendaires.** Ils sont gravés sur la carte (js/cartable.js:134-150), mais aucun écran ne les relit ; seul un toast les dit (js/rogue-jeu.js:925-933).
- **nouveau:pack-scelle / date-limite / nouveau:sort-de-la-run.** Après la date limite, un pack de joueurs scellé « s'ouvre la saison prochaine » (js/rogue-jeu.js:197). Il ne passe pourtant qu'à la saison suivante d'une run qui CONTINUE (1343) : si la run finit, ou en mode Saison, le pack payé est perdu. Le toast et le bouton renvoient à « Tes packs » (181 ; js/magasin.js:176), alors que la section s'appelle « 📦 Déjà à toi » (js/magasin.js:85).
- **adjoint / nouveau:report-de-saison.** L'inventaire dit « tu l'engages à chaque saison » (js/inventaire.js:145), alors qu'un patron engagé reste en poste toute la run (js/rogue-jeu.js:1340-1341, 1041).
- **modif-joueur / cartable.** Les mods suivent la carte d'une run à l'autre et s'accumulent sans limite (js/cartable.js:122). Rejouées au jour 0 (js/rogue-jeu.js:1175), elles occupent les cases du verso (js/banque.js:407-420) : une carte Base peut arriver pleine, ou avec plus de mods que de cases, sans que l'écran l'annonce.
- **nouveau:numerotation / revente / variante.** La fiche dit « Le numéro est un honneur, pas un bonus » (js/magasin.js:171). Pourtant le numéro multiplie la revente (×10 pour un 1 de 1, js/rogue-jeu.js:241) et change le tirage des bonus de la carte (js/repechage.js:90-97).
- **walkout / pack-joueurs.** La carte annoncée est la dernière retournée, et l'ordre est trié d'abord par finition (js/gerant.js:288-294) : un Phénomène en Base passe avant une Holo Soutien. Le commentaire de js/rogue-jeu.js:303 dit pourtant « le Phénomène en dernier ».
- **cartable / run / plombiers-depart.** Le cartable est partagé par tous les modes : l'historique est migré et chaque alignement de Saison y entre (js/game.js:1965, 1986). La toute première run Rogue peut donc déjà tirer son vestiaire et son classeur de cartes repêchées en mode Saison, alors que les règles disent « dès la deuxième run » (index.html:490).
- **jetons (mode Saison).** En dehors du Rogue, une victoire vaut 8 🪙 (barème JETONS, js/rogue-jeu.js:118 ; js/rogue.js:42) contre 5 en Rogue. Les règles ne donnent que le barème du Rogue (index.html:490).
- **jetons / run.** « Tu pars avec 40 jetons » (index.html:490), mais la caisse est versée de nouveau à CHAQUE saison de la run, en plus du reste (js/rogue-jeu.js:1349).
- **variante / sur-table.** Les bonus de variante s'affichent sur les cartes au repêchage, mais le plateau Sur table ne lit jamais `_carte` (js/table.js).
- **club-cosmetique / boutique.** Un nom ou une couleur achetés en mode Saison ne se « portent » ensuite qu'au vestiaire des déblocages du Rogue (js/game.js:1254 ; js/rogue-jeu.js:1436). Le rayon « Ton club » est caché au joueur débutant (js/magasin.js:127).
- **boutique / run.** Le toast de départ dit « la boutique t'attend au bureau » (js/rogue-jeu.js:845), mais elle n'ouvre qu'en saison (js/game.js:1899).
- **icône 🛡️.** Elle sert au Pack Défensif et au déblocage (js/packs.js:115 ; js/rogue.js:87), au rôle de patron « Adjoint à la défensive » (js/banque.js:55), au roulement « Banc profond » (js/sim.js:1208) et au trophée Selke (index.html:457). C'est contraire à la règle « une icône = un sens » de CLAUDE.md.
- **prestige / jalons.** Au rang Club de garage, Phénomène ×0 : aucun pack à niveaux ne donne de Phénomène (js/rogue.js:164 ; js/packs.js:248-257). Le jalon « Tous les niveaux » en exige un (js/rogue.js:423) ; seuls les packs talent ou Trio, qui ne tirent pas de niveau, peuvent le donner, et rien à l'écran ne le dit.

## Les mécaniques, par moment du parcours

### Départ de la run (12)

#### Nouvelle partie » : format · `nouveau:reglages-repechage`
*Tu vois, tu fais :* tu choisis 4 modes (Classique, Loto, Express, Loto express), une saison à gagner ou non, et d'où viennent les joueurs.
*Ça change :*
- **La roulette tourne…** — saison fixée → plus d'« Autre année » (grisé, « Le repêchage est fixé à … »
- **Le dé du pari** — franchise → plus d'« Autre équipe », chaque tour une autre saison de la franchise
- **Renfort** — tiré de la même saison/franchise
- **Plafond restant » 95,5 M$** — 95,5 M$ ou 34 M$
- **Autre année** — 2/2/2 ou 2 (loto
*Fichiers :* js/game.js:165-189, 266-276, 2468-2517 ; js/sim.js:57-74

#### Puce d'identité · `nouveau:identite-depart`
*Tu vois, tu fais :* choisie au démarrage ; une puce sur la roulette, et une étiquette sur les cartes qui « collent » (score ≥ 0,62).
*Ça change :*
- **La roulette tourne…** — tire un 2e club et garde celui qui colle le mieux (moyenne des 5 meilleurs signables ; en loto, le joueur offert
- aucun effet moteur
*Ça dépend de :*
- **🎯 Sniper Or** — scoreIdentite
- **Ruban « Recrue** — scoreIdentite
- **Le montant sur la carte** — scoreIdentite
*Fichiers :* js/game.js:283-297 ; js/repechage.js:692-699, 764-767, 795-798 ; js/identites.js:42-76

#### Express · `express`
*Tu vois, tu fais :* tu combles 6 cases (1er trio, 1re paire, partant) sous 34 M$ ; la carte « Renfort » du tableau de bord nomme le club qui fournit les 17 autres. même boutique, mêmes packs, même inventaire et mêmes coachs en saison ; les renforts ne comptent pas au plafond. Pas de Rogue : jetons à 0, barème JETONS.
*Ça change :*
- **Les 23 cases** — casesDuMode : unit 0 F/D/G
- **Plafond restant » 95,5 M$** — 34 M$
- **Renfort** — renfort
- **La boutique** — salaireMax sous 34 M$), confiance (sans coach choisi
- **Pack Bronze/Argent/Or/Premium** — salaireMax sous 34 M$), confiance (sans coach choisi
*Ça dépend de :*
- **Nouvelle partie » : format** — reglages-repechage
*Fichiers :* js/sim.js:66-73, 82-85 ; js/repechage.js:1056-1059 ; js/banc.js:774-777 ; js/game.js:325-329

#### Le mode Rogue · `run`
*Tu vois, tu fais :* un écran 💀 : « Une équipe de plombiers, 🪙 N jetons, plusieurs saisons… » avec la liste de tes déblocages (classeur, packs, gardés, réservistes, deck aiguisé, 📈 rang). Ensuite tu passes par le coach, les gardés, le classeur, puis l'alignement. Tu lances la saison quand tu veux.
*Ça change :*
- **Ton coach** — choix obligatoire, « Retour » annule
- **Garder un joueur** — gardes
- **Le départ du classeur** — classeur
- **Tes plombiers** — plombiers-depart
- **Plafond restant …** — G.rogue.plafond
- **🪙 N jetons** — G.rogue.depart = jetonsDeDepart
- **📈 Club de garage … Dynastie** — rang FIGÉ au départ dans G.rogue.prestige
- **🪑 N réservistes** — reserves-rogue
- **Avant le match » : la main** — deckPlus
- **Le proprio veut : faire les séries** — saison 1 = « faire les séries »
- **Le départ du classeur** — meta.runs +1 (change la graine du classeur
*Ça dépend de :*
- **Le vestiaire des déblocages** — deblocages
- **(ce que le repêchage y envoie)** — s'il n'est pas vide, le vestiaire vient de lui
- **🏅 écussons** — montrés
- **📈 Club de garage … Dynastie** — prestige
*Fichiers :* js/rogue-jeu.js:698-731, 805-846 ; js/rogue.js:268-276

#### Ton coach · `coach`
*Tu vois, tu fais :* trois coachs tirés de la graine du classeur (recharger redonne les mêmes) ; chacun montre son mot, « Son dépisteur recrute… », les puces de sa Confiance I et « N cartes de sa couleur ». Tu en prends un.
*Ça change :*
- **Confiance I** — décision du jour 0 : coachsDeBase {coach: 3} + Confiance I, en saison 1 seulement
- **Son dépisteur recrute des patineurs qui…** — mods.coach des packs de joueurs
- **Pack Personnel** — le Pack du coach le présélectionne
- **🏆 Ta vitrine** — le coach est inscrit avec la Coupe
*Ça dépend de :*
- meta.sel + meta.runs (graine)
- COACHS (9 coachs : 🐝 Frelon, 🦅 Aigle, 🐢 Tortue, 🦏 Rhino, 🫁 Doc, 😇 Abbé, 🪜 Contremaître, 🌠 Showman, 🏦 Comptable)
*Fichiers :* js/rogue-jeu.js:738-752 ; js/coachs.js:105-127 ; js/banc.js:643-644

#### Garder un joueur · `gardes`
*Tu vois, tu fais :* les cartes de ta dernière équipe ; tu en touches une par tour (« Garder »), ou « Personne ».
*Ça change :*
- **Tes plombiers** — les gardés passent devant, placerDevant
- **Plafond restant …** — le plafond monte à masse + 12 M$, ligne « Ta masse de départ »
- **Le départ du classeur** — une même personne ne revient pas
*Ça dépend de :*
- **Le vestiaire des déblocages** — deblocages garder1/2/3 (40/120/240 🏅, de 1 à 3 joueurs
- **Le dé du pari** — meta.derniereEquipe (écrite à la fin de chaque saison
*Fichiers :* js/rogue-jeu.js:679-691, 720-728, 855-864 ; js/rogue.js:275

#### Le départ du classeur · `classeur`
*Tu vois, tu fais :* des cartes de ton cartable avec « Prendre / ✓ Prise · Remettre », une barre « 📒 Budget du classeur », « Budget : il manque X ». Ouvert, tu as les filtres Avants/Défenseurs/Gardiens et une recherche. Puis « Commencer la run · N cartes ».
*Ça change :*
- **Tes plombiers** — les cartes prises entrent dans le vestiaire et gardent leur meilleure variante et leurs mods
- **Carton Base** — variante
*Ça dépend de :*
- **Le vestiaire des déblocages** — classeur1–3 : 1 à 4 cartes ; classeurTri : deux fois plus montrées ; classeurChoix : tout le classeur
- **🏁 Les jalons** — series offre classeur1, cent offre classeurTri, coupe offre classeurChoix
- **📈 Club de garage … Dynastie** — +0/3/6/10/15 M$ au budget
- **📈 Club de garage … Dynastie** — budget = 82 M$ + vestiaire − 12 M$ − 45 M$ + prestige (25 M$ sans rien
- **(ce que le repêchage y envoie)** — cartable
*Fichiers :* js/depart.js:1-128 ; js/rogue.js:132-146, 187-189 ; js/rogue-jeu.js:770-797, 1206-1241

#### Tes plombiers · `plombiers-depart`
*Tu vois, tu fais :* un alignement de 23 déjà posé et un toast qui le résume. Tu peux permuter, relâcher un réserviste, lancer la saison.
*Ça change :*
- **Les 23 cases** — case-alignement
- **Le montant sur la carte** — la masse de départ
- **Plafond restant » 95,5 M$** — la masse de départ
- **(ce que le repêchage y envoie)** — marquerJouees, r +1 par run
*Ça dépend de :*
- **(ce que le repêchage y envoie)** — cartable. S'il est vide, ce sont 23 joueurs de la ligue : 8 saisons au hasard, la tranche 10–30 % de production (30–50 % avec plombiersPlus, 80 🏅). Sinon, tes cartes Soutien et Régulier, les moins jouées (r) d'abord, avec un quota Soutien = max(5, 23 − 3 × rang − 3 × (saison − 1)). Le reste en dépend aussi : prestige (rang), gardes et classeur (comptent dans le quota), budget 82 M$ + vestiaire − 12 M$. Les trous sont comblés par des plombiers de la ligue
*Fichiers :* js/rogue.js:211-254 ; js/rogue-jeu.js:595-659, 799-804

#### Plafond restant … · `nouveau:plafond-rogue`
*Tu vois, tu fais :* la barre du haut affiche « Plafond restant » avec ✦ quand il est tordu ; l'infobulle nomme les lignes. Les jetons et 🏅 sont à côté (« 🪙 N · M 🏅 »).
*Ça change :*
- **Pack Bronze/Argent/Or/Premium** — salaireMax = espace + le plus gros cap hit libérable
- **Signer** — bloqueParLePlafond
- **X arrive : qui sort ? » puis « Où joue X ?** — bloqueParLePlafond
- **Journée suivante** — la saison ne démarre pas si le plafond est dépassé
*Ça dépend de :*
- **Le vestiaire des déblocages** — deblocages plafond1/2 (+3, puis +4 M$
- **💵 Masse salariale** — cartes 💵
- **L'adjoint joue cette série** — adjoint dir_flexible/dir_agent (+5 %/+2,5 %
- **Confiance I** — confiance du Comptable III (+5 %
- **Le dé du pari** — espace minimal de 12 M$
*Fichiers :* js/rogue.js:118-125 ; js/rogue-jeu.js:43-67, 855-864 ; js/game.js:348-367

#### Le proprio veut : faire les séries · `mandat`
*Tu vois, tu fais :* au hub, « 💀 La run · Saison N · le proprio veut : … · puis : … · 🏆 le but : la Coupe » ; au bilan, « Mandat rempli » ou « Mandat manqué ».
*Ça change :*
- **Run N** — continue, finie ou gagnée
*Ça dépend de :*
- **Séries éliminatoires** — qualification, rondes gagnées). Saison 1 : faire les séries
- 2 : une ronde
- 3 : les demi-finales
- **Le mode Rogue** — 4 et plus : la finale. La Coupe gagne la run
*Fichiers :* js/rogue.js:387-396 ; js/rogue-jeu.js:1005-1014

#### 📈 Club de garage … Dynastie · `prestige`
*Tu vois, tu fais :* au vestiaire, l'échelle « Étoiles ×0,4 · Phénomènes ×0 · classeur +… » avec ce qui manque (« 350 🏅 à vie et « Faire les séries » »). Dans la fiche d'un pack, « 📈 Club … : ton prestige ouvre… ».
*Ça change :*
- **Pack Bronze/Argent/Or/Premium** — taux Étoile ×0.4/0.7/1/1.15/1.3, Phénomène ×0/0.3/0.7/1/1.3 ; la différence va aux Piliers
- **Le départ du classeur** — +0/3/6/10/15 M$
- **Tes plombiers** — −3 Soutien par rang
- **Ton club** — verrous de rang 1 à 4
*Ça dépend de :*
- **🏅 écussons** — ecussons à vie (0/120/350/700/1200
- **🏁 Les jalons** — series, ronde, finale
*Fichiers :* js/rogue.js:163-179 ; js/packs.js:248-257 ; js/rogue-jeu.js:1415-1422

#### 🪑 N réservistes · `nouveau:reserves-rogue`
*Tu vois, tu fais :* des cases de réserve en plus, qui peuvent rester vides. ✕ relâche un réserviste. Toucher une case vide dit « un joueur signé à la boutique pourra y entrer sans que personne sorte ».
*Ça change :*
- **Signer** — un joueur de pack entre sans qu'on choisisse qui sort
- **Réservistes** — il monte quand un habillé se blesse
- **Plafond restant » 95,5 M$** — relâcher libère de l'espace
*Ça dépend de :*
- **Le vestiaire des déblocages** — deblocages banc1/2
- **🏁 Les jalons** — ronde
*Fichiers :* js/rogue.js:181 ; js/game.js:307-316, 369 ; js/alignement.js:291-295, 360-363 ; js/repechage.js:428

### Repêchage (27)

#### La roulette tourne… · `roulette`
*Tu vois, tu fais :* une carte club (écusson, « MTL 1976-77 », « · disparue », lien Hockey-Reference) ; en Loto « Loto · 3 clubs » + 3 pastilles. Elle retourne à CHAQUE signature (pas après un ✕). Si l'alignement est complet sans roulette : « Alignement complet ».
*Ça change :*
- **Vestiaire » : le bassin** — le bassin = tout le club tiré (≥ 8 joueurs, au moins un plaçable, 25 essais
- **Le loto** — 3 clubs (30 essais : 20 dans le budget du choix, 6 sous le plafond restant, puis n'importe quoi
- **🐝 Le Frelon** — couleur de l'interface (applyTeamColors, Vestiaire seulement
- **Puce d'identité** — tire 2 clubs, garde le meilleur
*Ça dépend de :*
- **Nouvelle partie » : format** — saison fixée / franchise / toutes
- **… et la roulette ne tournera pas pour cette…** — `G.dette>0` → pas de nouveau tour
- **Plafond restant » 95,5 M$** — maxForPick en loto
- **Les 23 cases** — openSlots
*Fichiers :* js/repechage.js:735-818 (nextSpin), 706 (vestiaireAuHasard), 865-974 (renderSpin) ; js/game.js:2511

#### Vestiaire » : le bassin · `vestiaire-draft`
*Tu vois, tu fais :* le club entier, en six colonnes AG C AD DG DD G (« n dispo », « 2/4 ») au bureau, en liste au téléphone. Chaque carte : carton de série, salaire, chiffre clé, badge + zone (+ identité), destination si elle pose problème (« ⚠ bloque la fin », « −3 hors position », « ▼ sous sa zone : 2e trio · AG », « ▲ au-dessus de sa zone ») et le bouton (« Signer », « Signer · bloque la fin », « Hors budget », « Position pleine », « ✓ Signé »). Toucher la carte ouvre la fiche.
*Ça change :*
- **Signer** — signature
- **Les 23 cases** — destinationFor : la case visée, sinon la case libre la plus sensée — pénalité ×40, distance à la zone, rang de l'unité
*Ça dépend de :*
- **Plafond restant » 95,5 M$** — over, risky
- **Budget du choix** — over, risky
- **C** — penaliteAffichee
- **Étiquette « 1er-2e trio** — zoneEcart
- **🎯 Sniper Or** — badge
- **Le gros chiffre de la carte : « 82 PTS** — chiffre-cle
- **Carton Base** — tc-*, ✦ à la première apparition
- isPicked par personne-saison (un joueur échangé ne se signe qu'une fois)
*Fichiers :* js/repechage.js:1220-1327, 1441-1516 ; js/game.js:378-398, 478-506

#### Le loto · `loto`
*Tu vois, tu fais :* la case en gros (« 1er trio · AG »), 3 clubs, un joueur par club ; « Relancer les trois ». Viser une autre case vide recompose la main avec les mêmes clubs ; ranger l'alignement ne la change pas. la saison, les cartes et les variantes sont les mêmes ; en Rogue, ni roulette ni loto.
*Ça change :*
- **Signer** — dans la case de la main seulement
- **(invisible) le rang offert ne remonte jamais** — echelle-loto
*Ça dépend de :*
- **C** — joueurs du club SANS pénalité à cette position, rangés par la cote cachée v, pris au rang de la case (repli : autoRoster
- **Le dé du pari** — joueurs du club SANS pénalité à cette position, rangés par la cote cachée v, pris au rang de la case (repli : autoRoster
- **C** — secondaire comprise
- **Case ciblée : 2e trio** — case-ciblee
- **Renfort** — exclu du rang
*Fichiers :* js/game.js:411-506 ; js/sim.js:104-117 ; js/repechage.js:893-929 ; js/alignement.js:350-352 ; js/game.js:1579 ; js/alignement.js:360-363

#### (invisible) le rang offert ne remonte jamais · `nouveau:echelle-loto`
*Tu vois, tu fais :* rien à l'écran. Après un n° 1 à un poste, les mains suivantes à ce poste offrent le n° 2, le n° 3…, même si tu déplaces ou retires des joueurs.
*Ça change :*
- **Le loto** — rang = max(unité de la case, nombre de signés sans pénalité à ce rôle, plancher G.echelle[rôle]
*Ça dépend de :*
- **Signer** — poserEchelle après chaque signature
- **C** — position
*Fichiers :* js/game.js:211-228, 451-468

#### Autre année · `relances`
*Tu vois, tu fais :* trois boutons avec leur compteur (REROLLS 2/2/2) ; en loto, un seul (MODES.relances 2). Aucune ne se recharge pendant la partie.
*Ça change :*
- **La roulette tourne…** — « Autre année » = autre saison, même code de club s'il existe
- « Autre équipe » = même saison
- « Passer » = saison + club neufs
- **Le loto** — loto = 3 clubs neufs
*Ça dépend de :*
- **Nouvelle partie » : format** — grisés en saison/franchise fixée
- il faut au moins une case à combler
*Fichiers :* js/sim.js:29, 59-73 ; js/repechage.js:918-928, 955-973 ; js/game.js:2494-2495

#### … et la roulette ne tournera pas pour cette… · `nouveau:dette-tour`
*Tu vois, tu fais :* un ✕ sur une case (ou « Retirer X ») vide la case et le dit dans un toast ; la signature suivante ne fait pas tourner la roulette.
*Ça change :*
- **La roulette tourne…** — G.dette++ au retrait, −1 à la signature au lieu d'un tour
*Ça dépend de :*
- **Les 23 cases** — ✕), nouveau:impasse-plafond
*Fichiers :* js/game.js:211-228 ; js/alignement.js:314-326 ; js/repechage.js:1385-1386, 1428-1436

#### Case ciblée : 2e trio · `nouveau:case-ciblee`
*Tu vois, tu fais :* toucher une case vide la vise (🎯 sur la carte : « 🎯 2e trio · C ») ; en loto, la main se recompose pour cette case.
*Ça change :*
- **Vestiaire » : le bassin** — destinationFor la préfère si le joueur peut la jouer
- **Le loto** — case de la main, rang remis à zéro puis plancher de l'échelle
- **Le dé du pari** — « À combler » du tableau de bord
*Ça dépend de :*
- **Les 23 cases** — fits
*Fichiers :* js/alignement.js:364-371 ; js/repechage.js:885-891, 1220-1225 ; js/game.js:411-434

#### Renfort · `renfort`
*Tu vois, tu fais :* 17 cases déjà habillées par une vraie équipe (≥ 20 joueurs, sans trou) ; on ne les déplace pas (« Les renforts sont fournis… »), on ne les retire pas.
*Ça change :*
- **Plafond restant » 95,5 M$** — 0 $, hors signes(
- **Le loto** — exclus du rang
- **Puces d'unité « 🧩 Ligne d'origine** — un club-saison entier → « 🧩 Ligne d'origine » sur les trios 2-4 et les paires 2-3
- **Étiquette « 1er-2e trio** — zone/trio-paire/chimie comme n'importe quel joueur
- **En-tête d'unité : « Trio de snipers** — zone/trio-paire/chimie comme n'importe quel joueur
- **Chimie** — zone/trio-paire/chimie comme n'importe quel joueur
- **(ce que le repêchage y envoie)** — non : alignementAuCartable ne prend que signes(
*Ça dépend de :*
- **Express** — express
- **Nouvelle partie » : format** — saison/franchise
- autoRoster
*Fichiers :* js/game.js:2364-2391, 325-329 ; js/alignement.js:263, 295-302, 341

#### Plafond restant » 95,5 M$ · `plafond`
*Tu vois, tu fais :* le montant restant, la jauge (orange « serré » sous 1,5 M$ par case restante ; rouge si dépassé), un repère « au rythme », le compte de signés, « 3,2 M$ / case », puis « Sous le plafond ✓ ».
*Ça change :*
- **Vestiaire » : le bassin** — « Hors budget » quand salaire > restant
- **Budget du choix** — budget-du-choix
- **Signer** — signature refusée au-delà
- **Le dé du pari** — bouton « Lancer la saison » bloqué si dépassé (« Plafond dépassé de … »
- **X arrive : qui sort ? » puis « Où joue X ?** — cases grisées « Plafond : il manque … »
*Ça dépend de :*
- **Le montant sur la carte** — salaire
- **Express** — express/MODE
- **💵 Masse salariale** — plafondEffectif et capHit en saison
- **Renfort** — gratuit
*Fichiers :* js/game.js:348-370 ; js/repechage.js:824-863 ; js/rogue-jeu.js:43-67, 341-348 ; js/alignement.js:592-611

#### Budget du choix · `nouveau:budget-du-choix`
*Tu vois, tu fais :* le plafond restant moins 0,775 M$ (MIN_SAL) par case restante après celle-ci ; une carte au-delà affiche « Signer · bloque la fin », et il faut deux touchers (le 1er montre ce qui resterait).
*Ça change :*
- **Vestiaire » : le bassin** — le compte « signables »
- **Le loto** — critère des 20 premiers essais
*Ça dépend de :*
- **Plafond restant » 95,5 M$** — plafond
- **Les 23 cases** — slotsLeft
*Fichiers :* js/game.js:66, 513 ; js/repechage.js:1010-1012, 1037-1050, 1232, 1291-1324

#### ⚠ Aucune signature possible ici · `nouveau:impasse-plafond`
*Tu vois, tu fais :* un bandeau quand rien ne tient sous le plafond restant : le moins cher du club, les relances qui restent, et un bouton qui retire ton plus gros contrat.
*Ça change :*
- **Les 23 cases** — la case se vide
- **… et la roulette ne tournera pas pour cette…** — +1
*Ça dépend de :*
- **Plafond restant » 95,5 M$** — plafond
- **Autre année** — relances
*Fichiers :* js/repechage.js:1398-1439

#### Le montant sur la carte · `salaire`
*Tu vois, tu fais :* le salaire en valeur 2026 (ou d'époque en option) ; au verso de la fiche, « Salaire réel » (publié, depuis 1989-90, ramené au plafond, lissé à 50 % avant 2005) ou « Salaire estimé » (barème selon la cote cachée : 50 → 0,775 M$… 99 → 18,5 M$ ; barème pré-1990 plus bas ; gardien ×0,90 ; contrat d'entrée plafonné).
*Ça change :*
- **Plafond restant » 95,5 M$** — plafond
- **Budget du choix** — budget-du-choix
*Ça dépend de :*
- **Ruban « Recrue** — contrat d'entrée : p.elc
*Fichiers :* js/ratings.js:35-79, 786-865, 1373-1392 ; js/game.js:68, 943-970, 1045-1049

#### Signer · `signature`
*Tu vois, tu fais :* la carte vole vers l'onglet Alignement, sa case luit ; un toast seulement s'il y a un hic (« → 2e trio · AG (−3 hors position) · ▼ sous sa zone »).
*Ça change :*
- **Les 23 cases** — case-alignement
- **La roulette tourne…** — tourne, sauf dette
- **(invisible) le rang offert ne remonte jamais** — echelle-loto
- **Plafond restant » 95,5 M$** — plafond
- **(ce que le repêchage y envoie)** — au lancement de la saison, alignementAuCartable
*Ça dépend de :*
- **Vestiaire » : le bassin** — vestiaire-draft/loto
- **Le loto** — vestiaire-draft/loto
- **Plafond restant » 95,5 M$** — refus au-delà du restant seulement
- **Budget du choix** — confirmation à deux touchers sur la carte du bassin
*Fichiers :* js/repechage.js:1361-1390 ; js/fiche.js:342, 446-455 ; js/game.js:1986-1990

#### Pastille Soutien · `niveau`
*Tu vois, tu fais :* un rang dans SA vraie saison, à son poste : points par match (patineur) ou buts évités (gardien) parmi les réguliers (≥ 40 PJ ou la moitié de la saison ; gardien ≥ 30 ou 35 %) ; seuils 50 % / 20 % / 4 % / 1 %.
*Ça change :*
- **Le dé du pari** — rien dans le moteur de match
- **Pack Bronze/Argent/Or/Premium** — taux par niveau
- **Au ballottage** — « Régulier au plus »
- **📈 Club de garage … Dynastie** — ouvre Étoiles/Phénomènes
- **Le repêchage** — cartes Soutien
*Ça dépend de :*
- **Le dé du pari** — les vraies stats de la saison
*Fichiers :* js/niveaux.js:45-115 ; js/repechage.js:115-127, 570-581 ; js/alignement.js:218

#### 🎯 Sniper Or · `badge`
*Tu vois, tu fais :* le rôle premier (7 rôles d'avant, 5 de défenseur) à un palier Bronze/Argent/Or/Platine (seuils F 78/92/98, D 76/89/98 sur le score du rôle, toutes saisons) ; un second si son score ≥ 60 ; le trait qui le monte. l'icône + palier en couleur dans la case et le tiroir ; la règle « Au Platine… L'Or ¾, l'Argent ½, le Bronze ¼ ».
*Ça change :*
- **Les canaux du moteur** — effet par joueur = EFFET_ROLE × (palier/4 − moyenne de la ligue) (½ pour le second) : checker/défensif −8 %, two-way/physique −4 %, bagarreur −6 % de finition adverse, power +8 %, plombier −40 % d'usure, sniper ×2 en AN, offensif +16 %, passeur/manieur +12 de fit (chimie
- **Fit** — le score de chaque rôle
- **Système du trio** — le score de chaque rôle
- **🐝 Le Frelon** — coachDuJoueur, « Joueur du Frelon »
- **Le gros chiffre de la carte : « 82 PTS** — chiffre-cle
- **En-tête d'unité : « Trio de snipers** — nom « Trio de snipers »
- **Le dé du pari** — identité de l'unité
- **Les canaux du moteur** — moteur-canaux par joueur pendant ses présences, centré sur BADGE_LIGUE : checker/défensif −8 % qualité des lancers adverses, two-way/physique −4 % (defense
- bagarreur −6 % finition du trio adverse (« intimide »)
- power forward +8 % finition des coéquipiers
- **Jambes** — plombier −40 % usure (jambes
- **Avantage numérique** — sniper ×(1+maîtrise) dans le choix du tireur en avantage-numerique
- **Le dé du pari** — défenseur offensif +16 % volume de sa paire
- **Le dé du pari** — passeur/manieur +12 de fit (chimie
- **Fit** — passeur/manieur +12 de fit (chimie
- **Chimie** — passeur/manieur +12 de fit (chimie
*Ça dépend de :*
- les vraies stats (rolesBruts)
- **Icônes 🛡️ Selke** — TRAITS_DU_BADGE
- **🧬 Modif de joueur** — _mutProfils
- **Pastille Soutien** — le trait monte le palier, SEUILS_PALIER F 78/92/98
- **Icônes 🛡️ Selke** — le trait monte le palier, SEUILS_PALIER F 78/92/98
*Fichiers :* js/sim.js:1353-1372, 1849-1901, 4073-4078, 4598-4646, 2300, 2453 ; js/gerant.js:144-152 ; js/fiche.js:50-76 ; js/sim.js:1849-1901, js/sim.js:2453, js/sim.js:4072-4079, js/sim.js:4601, js/sim.js:4630, js/sim.js:4646

#### Le gros chiffre de la carte : « 82 PTS · `nouveau:chiffre-cle`
*Tu vois, tu fais :* un seul chiffre de la vraie saison selon le badge premier (gardien %ARR ; bagarreur PUN ; checker/plombier/physique MÉ/M dès 2005-06, sinon PUN pour le physique ; défensif TB/M, sinon +/M ; les autres PTS) ; la case ajoute « n pts · x/m » s'il n'est pas en points.
*Ça change :*
- rien dans le moteur (affichage)
- le robot du smoke trie dessus
*Ça dépend de :*
- **🎯 Sniper Or** — badge
- **Statistiques : Réelles** — prorata change PTS
*Fichiers :* js/game.js:909-940 ; js/alignement.js:219, 244-249 ; js/repechage.js:161-165, 1256-1261

#### Étiquette « 1er-2e trio · `zone`
*Tu vois, tu fais :* les unités où il rend à 100 % (lues dans la cote cachée v : F ≥ 78 T1 ; ≥ 55 T1-2 ; ≥ 46 T2-3 ; ≥ 40 T3-4 ; sinon T4 ; D 61/50/44 ; polyvalents T1-3/T2-4/P1-3/P2-3) ; la case vide nomme ses zones (« T1 · T1-2 ») ; ▼ en rouge avant de signer.
*Ça change :*
- **En-tête d'unité : « Trio de snipers** — malus d'unité
- au-dessus 1,5 × cran²
- **Le dé du pari** — × nombre de mal placés (1/1/1,6/2,2, ou 1/1/1,25/1,8 si tous à un cran), plafond 70
- **Plafond restant » 95,5 M$** — × nombre de mal placés (1/1/1,6/2,2, ou 1/1/1,25/1,8 si tous à un cran), plafond 70
- « hors » dès 15
- une unité optimale reçoit +2/+2
- **Les 23 cases** — destination auto
- adversaires (autoRoster)
*Ça dépend de :*
- la cote cachée v
- **C** — une secondaire élargit la zone
- **🧬 Modif de joueur** — « Monte d'un cran », « Joue en bas »
*Fichiers :* js/ratings.js:595-714 ; js/sim.js:184-353, 366-368, 519-588 ; js/game.js:392-401, 986-1006 ; js/alignement.js:209-211, 402-434, 542-590

#### C · `position`
*Tu vois, tu fais :* son poste et un poste secondaire ; la carte et la case disent −N hors position ; un groupe interdit (D à l'avant) n'est pas proposé par la destination auto.
*Ça change :*
- **Les canaux du moteur** — chaque sous-cote − pénalité, plancher 25) : centre à l'aile −3, ailier au centre −5, autre aile −2, D du mauvais côté −2, mauvais groupe 999
- **Le loto** — seuls les joueurs à 0 de pénalité sont offerts
- **(invisible) le rang offert ne remonte jamais** — echelle-loto
- **Étiquette « 1er-2e trio** — une secondaire → zones élargies T1-3/T2-4
*Ça dépend de :*
- le poste du shard
- **Le dé du pari** — poste secondaire = `secP` (absent des shards) sinon faceoff ≥ 45 % (ailier → C) ou un hachage de l'id (~40 %
- **Carton Base** — bonus Polyvalent
- **🧬 Modif de joueur** — « Joue partout »
*Fichiers :* js/ratings.js:660-684 ; js/sim.js:456-515 ; js/game.js:853-870

#### 🪨 Costaud · `carrure`
*Tu vois, tu fais :* un mot sur la fiche (physique ≥ 0,62 ou ≤ 0,38) ; la ligne : « 🪨 ligne costaude » (≥ 0,56) / « 🪶 ligne légère » (≤ 0,44) ; « un coup reçu ne lui coûte que 0,6 jambe » / « 1,8 jambes ». 🪨/🪶 dans l'infobulle du badge ; « 🪨 ligne costaude / 🪶 ligne légère » au-dessus de l'agressivité.
*Ça change :*
- **Agressivité** — rendement ×0,2…×2, punitions de trop ×0,2…×2
- **Les mises en échec coûtent des jambes** — coût d'un coup = 1,2 × (1 + 0,5 × (1 − 2·physique
- **Jambes** — coût d'un coup = 1,2 × (1 + 0,5 × (1 − 2·physique
- **Bagarre** — bagarre
- **Agressivité** — rendement 1+4(ph−0,5) borné 0,2–2, coût punitions 1−4(ph−0,5
- **Les mises en échec coûtent des jambes** — un coup reçu coûte 1,2×(1+0,5×(1−2ph)) jambes
- **Bagarre** — force et choix du combattant
- **Mêlée** — force et choix du combattant
*Ça dépend de :*
- **Robustesse** — robustesse mesurée (mr), gabarit (gb), trait COLOSSE
- **Robustesse** — robustesse mesurée), gabarit `gb`, trait Colosse
- **Icônes 🛡️ Selke** — robustesse mesurée), gabarit `gb`, trait Colosse
- seuils 0,62/0,38 (joueur), 0,56/0,44 (ligne)
*Fichiers :* js/sim.js:1769-1784, 1909 ; js/gerant.js:138, 962, 1102 ; js/fiche.js:77-81 ; js/sim.js:1770-1793, js/sim.js:1909, js/gerant.js:138, js/gerant.js:962

#### Icônes 🛡️ Selke · `trait`
*Tu vois, tu fais :* une icône rare (~1 % des joueurs-saisons), infobulle « Selke 1982-83 — Lauréat/Finaliste ». icônes 🛡️🧱🥅🏆⚡💣🧭🥊🔁🪄🧤 dans la case.
*Ça change :*
- **Les canaux du moteur** — habillés seulement) : défense 0,98/0,99 (plancher d'équipe 0,94
- présence 0,91/0,94
- gardien 0,96/0,98, Voleur 0,988
- **Plafond restant » 95,5 M$** — séries 1,03 (plafond 1,06
- lancers 1,035
- finition 1,03
- attaque 1,006
- meneur +2 (max 9)
- **Robustesse** — robustesse +0,5 σ (max 1,8
- **🎯 Sniper Or** — monte le palier
- **🪨 Costaud** — Colosse
- Selke/Norris défense d'équipe 0,98 (borne 0,94)
- Selke/🔁 −9 % pendant ses présences
- Vézina 0,96 / 🧤 0,988 sur le gardien
- ⚡ lancers 1,035
- 💣 finition 1,03
- 🪄 attaque 1,006 (borne 1,05)
- 🧭 +2 clutch en prolongation, séries 1,01
- 🏆 séries 1,03
- **Robustesse** — 🥊 robustesse +0,5
*Ça dépend de :*
- **Les trophées de la saison** — data/trophees.js, data/reputations.js
- **Ruban « Recrue** — Vitesse s'éteint après 34 ans
- grosse saison (md/mr ≥ 0,70) pour Colosse et Bidirectionnel
- être habillé (pas réserviste)
- grosses saisons (`md`, `mr` ≥ 0,70)
- **🎯 Sniper Or** — un trait monte le palier
*Fichiers :* js/traits.js:82-127, 169-209, 248-281, 296-395 ; js/game.js:1033-1043 ; js/traits.js:169-209, js/traits.js:296-395, js/sim.js:4548-4552, js/sim.js:4623

#### Ruban « Recrue · `age-recrue`
*Tu vois, tu fais :* le ruban suit la vraie saison recrue (data/recrues.json → p.rk) ; l'âge au 1er octobre est au verso.
*Ça change :*
- **Le montant sur la carte** — contrat d'entrée p.elc : 3 saisons à ≤ 21 ans, 2 à 22-23, 1 à 24, depuis 1995 ; base 1 % ou 2,7 % + bonis 3 %
- moteur (carte recrue : finition +1 % dès son 42e match, si p.elc)
- **Puces d'unité « 🧩 Ligne d'origine** — vétérans ≥ 31, jeunes ≤ 23
- **Icônes 🛡️ Selke** — Vitesse
- **Puce d'identité** — jeunesse/vieux routiers
*Ça dépend de :*
- bd (bios LNH ; sans elle, le tri par âge se cache)
*Fichiers :* js/repechage.js:42-61, 95-100, 570-579, 1162, 1170-1181 ; js/rarete.js:61, 101, 112 ; js/ratings.js:826-849, 1364-1374

#### 🏔️ Mur · `gardien-style`
*Tu vois, tu fais :* à la place d'un badge, le style d'un gardien (carte, case) ; une zone de gardien ; le chiffre clé %ARR.
*Ça change :*
- en saison, rien (le moteur lit %ARR et les cotes cachées o/d)
- **Sur table** — sur-table seulement (habileté du plateau
*Ça dépend de :*
- %ARR vs ligue, tirs par match, PJ (seuils ,012 / ,004, 25 et 55 PJ)
*Fichiers :* js/ratings.js:473-476, 512-521 ; js/game.js:1020-1023 ; js/alignement.js:200-207 ; js/fiche.js:67-69

#### Cases « Partant · `gardien-rotation`
*Tu vois, tu fais :* deux cases de gardien ; les règles parlent de 12 à 50 %, la carte ne dit rien de la part. deux boutons Partant/Auxiliaire avec % d'arrêts et jambes, « · la rotation » sur celui d'office ; toucher l'autre lui donne le filet pour CE soir.
*Ça change :*
- **Journée suivante** — la part de l'auxiliaire = ses PJ réels / (les deux), bornée 0,12-0,50
- **Le dé du pari** — sans auxiliaire, un gardien de rappel (sv de la ligue − ,015) prend 20 %
- quel facteur gardien joue chaque lancer
- **Les jambes d'un gardien** — jambes-gardien
*Ça dépend de :*
- **Les 23 cases** — qui est en case Partant
- les PJ réels des deux
- **Le dé du pari** — part réelle de l'auxiliaire 12–50 %
- sans auxiliaire, un rappel prend 20 % (sv −0,015)
- **Les événements** — carte/dilemme « l'auxiliaire au filet »
- **Rapport d'entracte** — entracte « Envoyer l'auxiliaire »
*Fichiers :* js/sim.js:4916-4995 ; js/sim.js:4927-5020, js/gerant.js:938-950

#### Les 23 cases · `case-alignement`
*Tu vois, tu fais :* une case = la bande (poste, club, salaire), le nom (ouvre la carte), le badge + palier, le niveau, ✓▼▲, la zone, −N, les traits, le chiffre clé ; toucher → « Touche une autre case pour déplacer ou permuter » ; ✕ retire ; en-têtes « 1er trio… » ; tuiles Masse / Vides / Unités en place / Unités mal placées / Joueurs hors position ; bouton « 14 / 23 · encore 9 » puis « Lancer la saison · 82 matchs ». 4 trios (AG·C·AD), 3 paires (DG·DD), Partant/Auxiliaire, 3 réservistes ; chaque case vide porte ses zones (« T1 · T1-2 »). Toucher une case puis une autre déplace/permute ; derrière le banc la case montre ✓▼▲, −N, 🩹, ses jambes et sa fiche du jour.
*Ça change :*
- **Étiquette « 1er-2e trio** — les réservistes ne jouent qu'en remplacement ; leurs traits ne comptent pas
- **C** — les réservistes ne jouent qu'en remplacement ; leurs traits ne comptent pas
- **−1,2** — les réservistes ne jouent qu'en remplacement ; leurs traits ne comptent pas
- **En-tête d'unité : « Trio de snipers** — les réservistes ne jouent qu'en remplacement ; leurs traits ne comptent pas
- **Cases « Partant** — les réservistes ne jouent qu'en remplacement ; leurs traits ne comptent pas
- **Réservistes** — les réservistes ne jouent qu'en remplacement ; leurs traits ne comptent pas
- **Le loto** — épingle de la main
- **En-tête d'unité : « Trio de snipers** — le rang de la case = la glace (PART_UNITE/POIDS_TRIO
- **Étiquette « 1er-2e trio** — malus de zone par unité
- **C** — −2/−3/−5 (fond en 15 matchs
- **Réservistes** — les cases scratch ne jouent pas
- **−1,2** — `_adapt[role]` +1 par match
*Ça dépend de :*
- fits (destination auto) — mais pas au déplacement manuel
- **Renfort** — verrouillé
- **Express** — 6 cases
- **Le dé du pari** — cases de réserve « 🔒 Au vestiaire des déblocages »
- **C** — `fits()` (F↔D interdit, G seulement en G
- **Étiquette « 1er-2e trio** — `fits()` (F↔D interdit, G seulement en G
- **Le vestiaire des déblocages** — les 2 cases de plus (Rogue
*Fichiers :* js/sim.js:355-399 ; js/alignement.js:198-376, 522-611 ; js/sim.js:369-399, js/sim.js:507, js/alignement.js:223-376

#### Carton Base · `variante`
*Tu vois, tu fais :* une carte sur quatre brille (75/17/6/2), tirée de la graine de la partie et de la clé du joueur ; le bonus se lit dans la gemme et au verso. la finition de la carte et ses lignes de bonus (« 📍 Précision — … +3 % »).
*Ça change :*
- **Les canaux du moteur** — seulement TON alignement, dès le lancement de la saison) : +3 % / +5 % / or 2×5 %
- **C** — Solide ×4, Clutch ×2, Polyvalent ×6 (pénalité hors position −18 % / −30 %
- **🧬 Modif de joueur** — 2 cases, 3 en holo/or
- **Les canaux du moteur** — moteur-canaux par joueur (Parallèle : 1 bonus à 3 % ; Holo : 1 à 5 % ; Or : 2 à 5 % ; solide ×4, clutch ×2 en gros match ou en séries, polyvalent ×6 ; recrue ELC : précision +1 % après 41 matchs
- **🧬 Modif de joueur** — holo ou or : +1 case
- **Vendre** — revente
*Ça dépend de :*
- graine
- **Pack Bronze/Argent/Or/Premium** — Rogue
- cotes 75/17/6/2 hors pack
- en pack, le tier
- **Le dé du pari** — les bonus sont tirés de la clé, de la variante et du numéro. Seule TON équipe les joue
*Fichiers :* js/rarete.js:37-114 ; js/repechage.js:76-102, 631-677 ; js/rarete.js:38-114 ; js/repechage.js:80-102

#### Pastilles « Tout 14/23 · `nouveau:filtres-vestiaire`
*Tu vois, tu fais :* filtrer par poste (compte signés/requis : 4-4-4-3-3-2), trier (Points/%ARR, Pts par match, Salaire, Pts par M$, Différentiel, Défensive, Robustesse, Âge, Nom), chercher un nom, n'afficher que les signables.
*Ça change :*
- l'affichage seulement
*Ça dépend de :*
- **Plafond restant » 95,5 M$** — onlyFit : salaire ≤ plafond restant
- **Le dé du pari** — mesures de saison (DEF/ROB
- **Ruban « Recrue** — age-recrue
*Fichiers :* js/repechage.js:1066-1191 ; js/alignement.js:125-144 ; index.html:338-341

#### (ce que le repêchage y envoie) · `cartable`
*Tu vois, tu fais :* signer fait voler la carte (vers l'onglet Alignement) ; l'alignement signé entre au cartable au lancement de la saison ; une carte qui sort (qui-sort, relâchée) y va avec sa variante. des feuilles de 9 pochettes, « Ton équipe / Saisons / Clubs », la complétion par club et par saison, les gemmes des variantes, ×N, № ; « 🎒 Mes cartes ».
*Ça change :*
- **Le départ du classeur** — classeur/depart d'une autre run
- **Le départ du classeur** — source
- **Tes plombiers** — source
- **🏁 Les jalons** — 100 cartes, 50 jouées
- **🧪 +N écussons de découverte** — prime-decouverte
*Ça dépend de :*
- **Signer** — signature, qui-sort, variante
- **X arrive : qui sort ? » puis « Où joue X ?** — signature, qui-sort, variante
- **Carton Base** — signature, qui-sort, variante
- **Pack Bronze/Argent/Or/Premium** — toutes les cartes tirées, doublons comptés
- **Signer** — variante neuve seulement
- **Au ballottage** — ballottage
- **Collection › Saisons** — migré une fois
- **🧬 Modif de joueur** — mods
- partagé par TOUS les modes
*Fichiers :* js/game.js:1986-1990 ; js/repechage.js:511-517, 1338-1359 ; js/banc.js:592 ; js/cartable.js:1-314 ; js/game.js:1957-1990

### Alignement (6)

#### Puces d'unité « 🧩 Ligne d'origine · `origines`
*Tu vois, tu fais :* sur l'en-tête d'un trio ou d'une paire complète, au plus deux puces, même sans les cartes.
*Ça change :*
- **Avant le match » : la main** — deck-match / carte de club (originesDe : coéquipiers dans les unités du haut, franchise, lignes d'origine, trios de décennie, vétérans, jeunes
*Ça dépend de :*
- **La roulette tourne…** — un vestiaire donne des coéquipiers
- **Vestiaire » : le bassin** — un vestiaire donne des coéquipiers
- **Renfort** — renfort
- **Ruban « Recrue** — age-recrue
*Fichiers :* js/sim.js:1533-1579 ; js/alignement.js:388-400, 449

#### En-tête d'unité : « Trio de snipers · `trio-paire`
*Tu vois, tu fais :* le nom de l'unité (badges premiers), sa production réelle additionnée, son verdict de zone, ses puces d'origine ; toucher → la fenêtre du système. l'en-tête d'unité dit « ✨ à leur place / ⚠️ un joueur mal placé / 🚨 hors de leurs lignes », l'identité (« Trio de snipers »), les pts/m additionnés, la puce d'origine ; la ligne u = trio u + paire u (la 4e ligne n'a pas de paire).
*Ça change :*
- **Système du trio** — fenêtre
- **Fit** — fenêtre
- **Chimie** — fenêtre
- **🔒 Trio de fermeture** — 🔒 derrière le banc
- **Chimie** — calculée par LIGNE (fit trio×3 + paire×2)/5
- **Glace** — un seul réglage par ligne, la paire suit son trio
- **Agressivité** — un seul réglage par ligne, la paire suit son trio
- **Les canaux du moteur** — chaque unité a son poids offensif (présence × volume^0,30 × chimie) et sa présence défensive
- **Qui joue contre qui** — la paire u joue surtout avec le trio u (APPARIEMENT_PROPRE 5,0
*Ça dépend de :*
- **🎯 Sniper Or** — badge, zone, origines
- **Étiquette « 1er-2e trio** — badge, zone, origines
- **Puces d'unité « 🧩 Ligne d'origine** — badge, zone, origines
- **Les 23 cases** — case-alignement
- **Étiquette « 1er-2e trio** — malus d'unité ZONE_PEN_*
- **Puces d'unité « 🧩 Ligne d'origine** — puce 🧩👬🎽🕰️ payée par les cartes de club
*Fichiers :* js/alignement.js:402-482 ; js/sim.js:1513-1532 ; js/sim.js:2079-2087, js/sim.js:3970-4022, js/alignement.js:402-482

#### ✕ « Relâcher X : sa carte va à ton cartable · `nouveau:relacher-reserviste`
*Tu vois, tu fais :* sur une case de réserve seulement ; confirmation « libère x $ sous le plafond ».
*Ça change :*
- **Plafond restant » 95,5 M$** — plafond
- **Les 23 cases** — case de réserve libre, qui ne bloque pas le lancement
- **(ce que le repêchage y envoie)** — cartable
- **X arrive : qui sort ? » puis « Où joue X ?** — « personne ne sort »
*Ça dépend de :*
- Rogue, scratch
*Fichiers :* js/repechage.js:525-549 ; js/alignement.js:291-296 ; js/game.js:368-369

#### Système du trio · `systeme`
*Tu vois, tu fais :* une rangée sous chaque unité ouvre la fenêtre : 8 systèmes de trio (🔥🌀🌧️🪤🏹🧲🧰🎲 Hourra), 6 de paire (🏠🛫💨🧹🌗🎲 Sans consigne), chacun avec son fit, ses puces chiffrées (« Tirs +7 % ») et « gain à N % », qui il étouffe, qui l'étouffe, un conseil 💡 si un autre irait ≥10 points mieux, « En face » le système adverse.
*Ça change :*
- **Les canaux du moteur** — gain × echelleFit(fit) + prix entier sur volume, finition, defense, discipline, energie (usure), physique (robTac) — ex. 🔥 volume 1,07 / discipline 1,10, énergie 1,06
- 🛫 volume 1,14 finition 1,03 / défense 1,05
- **Punitions** — 🧰 défense 0,97 physique 1,5 / discipline 1,12 énergie 1,08
- **Action spéciale du système** — `bat` étouffe un système de trio adverse
- **Chimie** — Hourra (trio ET paire) = chimie 0
- **Jambes** — prix `energie` dans `usureLigne`
- **📘 Maîtrise des systèmes** — chaque match joué l'apprend
*Ça dépend de :*
- **Fit** — fit
- nouveau:ia-defaut : une ligne non réglée prend `meilleureTactique`
- **Combat** — les PLANS_ADV règlent les systèmes adverses
- **Vestiaire » : le bassin** — vestiaire/cartes « stage » (GAIN_STAGE 0,4
*Fichiers :* js/sim.js:1613-1727, js/sim.js:2134-2154, js/sim.js:4057-4087, js/gerant.js:712-762

#### Fit · `fit`
*Tu vois, tu fais :* un mot par système et par ligne ; poste par poste, « Il demande AG 🦍 Power ✓/≈/✗ » ; « ailes inversées » quand le moteur permute AG/AD.
*Ça change :*
- **Système du trio** — gain × echelleFit = borne((fit−30)/45, 0, 1,25
- **Chimie** — plafond chimieMax = 1,6 × (fit − 35
*Ça dépend de :*
- **Le dé du pari** — score de rôle MOINS la part qui suit le talent, PENTE_TALENT
- **🎯 Sniper Or** — passeur/manieur ajoutent BADGE_CHIMIE 12 points de fit
- **📘 Maîtrise des systèmes** — +MAITRISE_FIT 15 × maîtrise
- **🧬 Modif de joueur** — `_mutProfils`
*Fichiers :* js/sim.js:1463-1484, js/sim.js:2100-2132, js/sim.js:2280-2288, js/gerant.js:698

#### Réservistes · `reserve`
*Tu vois, tu fais :* la rangée « Réservistes » ; derrière le banc « X le remplace » / « Ce soir : T2 » ; message « Qui prend sa case ? » à une blessure ; ✕ relâche (Rogue).
*Ça change :*
- **Blessures** — le 1er réserviste compatible monte dans la case EXACTE du blessé (n'importe quel trio
- **Jambes** — un réserviste ne s'use pas et récupère
- **Icônes 🛡️ Selke** — un réserviste n'apporte aucun trait
- **Une case que personne ne remplit** — case-vide si personne ne peut monter
*Ça dépend de :*
- **Les 23 cases** — `fits`
- **Au ballottage** — le nouveau arrive en réserve
- **Pack Bronze/Argent/Or/Premium** — le nouveau arrive en réserve
- **Le vestiaire des déblocages** — +1/+2
*Fichiers :* js/sim.js:383-399, js/sim.js:4865-4885, js/banc.js:73-80, js/saison.js:3255-3275

### La journée (58)

#### −1,2 · `adaptation-case`
*Tu vois, tu fais :* la pénalité de position du jour, qui fond en jouant ; le résumé : « la pénalité fond des deux tiers en 15 matchs ».
*Ça change :*
- **C** — pénalité × exp(−matchs/15) × effetCarte(horsPosition
*Ça dépend de :*
- **Les 23 cases** — compteur par RÔLE de case (AG, C, AD, DG, DD), matchs habillés seulement (pas la réserve
- remis à zéro chaque saison
- **Carton Base** — Polyvalent
*Fichiers :* js/sim.js:592-621, 2321-2327, 5877, 5901 ; js/alignement.js:226, 256

#### X arrive : qui sort ? » puis « Où joue X ? · `qui-sort`
*Tu vois, tu fais :* ton alignement en rangées ; chaque case dit « masse ±x $ » ; grisée si « X n'aurait aucune case » ou « Plafond : il manque … » ; colonnes Sort / Arrive (niveau, badge, salaire du jour, fiche à ce jour) ; puis sa case : « −3 », « Y → 3e trio » (le glissement).
*Ça change :*
- **Les 23 cases** — cases, quiGlisse
- **Plafond restant » 95,5 M$** — plafond
- **(ce que le repêchage y envoie)** — la carte qui sort y va, avec sa variante
- **Au ballottage** — décision {i, sort, cases}
*Ça dépend de :*
- **Plafond restant » 95,5 M$** — bloqueParLePlafond
- **C** — fits, penaliteAffichee
- **💵 Masse salariale** — capHitDuJour
- **Le dé du pari** — case de réserve libre : « personne ne sort »
*Fichiers :* js/repechage.js:370-502, 511-517 ; js/rogue-jeu.js:329, 341-348 ; js/banc.js:764

#### Chimie · `chimie`
*Tu vois, tu fais :* la barre « Chimie ce soir », « plafond de chimie : bas/bon/haut », la chimie de chaque système sur son bouton, les points •/••/••• sur l'affiche.
*Ça change :*
- **Les canaux du moteur** — bonusChimie = 6,5 × (c − 26)/100 points → exp(/42) mi-volume mi-finition de l'unité (NÉGATIF sous 26
- **Action spéciale du système** — chance SPEC_BASE 0,22 × c/100 par lancer FE du trio
*Ça dépend de :*
- **Fit** — plafond
- **🤝 Entente** — entente
- **📘 Maîtrise des systèmes** — maitrise-systeme
- **🎯 Sniper Or** — passeur, manieur
- **Système du trio** — Hourra = 0
*Fichiers :* js/sim.js:2244, js/sim.js:2290-2332, js/sim.js:4783-4793, js/sim.js:3987

#### 🤝 Entente · `entente`
*Tu vois, tu fais :* un mot sous la chimie ; derrière le banc « un nouveau venu bâtit son entente ».
*Ça change :*
- **Chimie** — moyenne des paires de coéquipiers d'une ligne, 1 − e^(−matchs/8) (ENTENTE_MATCHS 8), jamais perdue
*Ça dépend de :*
- **En-tête d'unité : « Trio de snipers** — garder les mêmes ensemble
- **Blessures** — les remplaçants cassent la paire
- **Réservistes** — les remplaçants cassent la paire
- **Le dé du pari** — carte de stage (ENTENTE_STAGE 12
*Fichiers :* js/sim.js:2239, js/sim.js:2258-2264, js/sim.js:2303-2311, js/sim.js:3050-3065

#### 📘 Maîtrise des systèmes · `maitrise-systeme`
*Tu vois, tu fais :* un mot sous la chimie ; un toast « Tes avants apprennent… » après une carte de stage.
*Ça change :*
- **Chimie** — (entente + maîtrise)/2 et +15 × maîtrise au fit
- **Fit** — fit
*Ça dépend de :*
- **Système du trio** — systeme joué ce soir (+8 % du manque par match, MAITRISE_PAS
- **Le dé du pari** — carte de stage (+40 %, GAIN_STAGE
- **Ton coach** — confiance porte un stage
*Fichiers :* js/sim.js:2239, js/sim.js:2268-2278, js/sim.js:2312-2319, js/sim.js:5552-5563

#### Agressivité · `agressivite`
*Tu vois, tu fais :* 4 boutons par ligne avec un verdict « ✓ payant / ✗ coûteux / ≈ neutre pour cette ligne » et des puces Défense/Punitions/Usure ; le titre dit la carrure de la ligne.
*Ça change :*
- **Le dé du pari** — defense de l'unité −def×rendementPhysique (0 / 0 / 3,5 % / 7 %
- **Punitions** — discipline +pun×coutPhysique (−0,15 / 0 / +0,15 / +0,30 punition de ligue
- **Jambes** — jambes usure ×0,98/1/1,04/1,09
- **Les mises en échec coûtent des jambes** — coups donnés ×(0,6+physique
- **Bagarre** — bagarre et mêlée : taux × agr moyenne
- **Robustesse** — robTac 1,5×(physique−0,4)×rendement
*Ça dépend de :*
- **🪨 Costaud** — physiqueLigne
- nouveau:ia-defaut : sans réglage, `meilleureAgressivite`
- **Le dépistage du match** — le dépistage propose d'en changer
- **Combat** — plan « matraquage » = agr 3 chez eux
*Fichiers :* js/sim.js:1740-1805, js/sim.js:2170-2179, js/sim.js:4080-4085, js/sim.js:1927, js/gerant.js:979-990

#### Glace · `glace`
*Tu vois, tu fais :* un curseur par ligne (pas de 5 s) et « ≈ mm:ss à forces égales ».
*Ça change :*
- **Les canaux du moteur** — moteur-canaux minutes F/D : part × sec/60 puis RENORMALISÉE (somme constante) — offensive (PART_UNITE 30/26/23,5/20,5 et 39/31,5/29,5) et présence défensive (POIDS_TRIO 34/28/22/16
- **Jambes** — usure ∝ (part/part moyenne)²
- **Les mises en échec coûtent des jambes** — coups donnés ∝ présence
*Ça dépend de :*
- **Roulement** — multiplicateurs F/D
- **Effets temporaires des dilemmes et…** — multiplicateurs F/D
- **Trois défaites de suite** — multiplicateurs F/D
- **Ton coach** — multiplicateurs F/D
- **L'adjoint joue cette série** — multiplicateurs F/D
- **Combat** — plan « vedette » : leur 1er trio 85 s
*Fichiers :* js/sim.js:1746, js/sim.js:1278-1294, js/sim.js:896-899, js/ratings.js:356, js/gerant.js:691-695

#### Consigne du match · `consigne`
*Tu vois, tu fais :* dans « Préparer le match », 3 boutons avec leurs puces ; « 🌡️ Haute conseillée » un soir de gros match ; vaut UN match.
*Ça change :*
- **Les canaux du moteur** — Basse finition 0,97×0,975 ≈ −5 %, défense 1,02×0,98 ≈ ±0, usure ×0,8
- **Blessures** — Haute finition ≈ +6 %, défense ≈ −1 %, blessure ×1,25, usure ×1,12 (IMPORTANCES × `ad` ±1
- **Combat** — `ad ≤ −1` « contre » le plan « vedette »
*Ça dépend de :*
- **Préparer le match** — preparer-match
- **Onglet Jambes** — propose Basse
*Fichiers :* js/sim.js:2063-2076, js/sim.js:2982-2991, js/gerant.js:907-913, js/sim.js:7188-7189

#### 🔒 Trio de fermeture · `trio-fermeture`
*Tu vois, tu fais :* derrière le banc, un 🔒 sur chaque en-tête de trio ; le 3e par défaut ; retoucher le libère.
*Ça change :*
- **Qui joue contre qui** — sur PLAN_FERMETURE 40 % des présences, ta fermeture défend contre LEUR 1er trio et leur 1er trio est visé par ta fermeture (1 v 3
- domicile = dernier changement (APPARIEMENT 2,5 contre 1,0 au visiteur)
- **Action spéciale du système** — c'est souvent lui qui étouffe leur 1er trio
*Ça dépend de :*
- **Derrière le banc** — derriere-le-banc
- **Icônes 🛡️ Selke** — Selke/Bidirectionnel −9 % pendant ses présences
- cote `d` cachée (K_DEFENSE)
*Fichiers :* js/sim.js:4270-4296, js/sim.js:4407-4425, js/sim.js:4092-4093, js/alignement.js:436-473, js/banc.js:113-116

#### Roulement · `roulement`
*Tu vois, tu fais :* proposé seulement dans « Les ménager » (onglet Jambes), par son prix ; repris au bilan.
*Ça change :*
- **Glace** — F [1,12 1,08 1,03 0,62] ou [0,92 0,97 1,05 1,16] (renormalisé
- **Robustesse** — robustesse −0,9/+0,9 écart-type
- **Blessures** — blessure ×1,30/×0,82
- **Jambes** — via la part de glace
*Ça dépend de :*
- **Onglet Jambes** — les-menager
*Fichiers :* js/sim.js:1195-1213, js/sim.js:1258-1259, js/saison.js:2261, js/bilan.js:696-697

#### Jambes · `jambes`
*Tu vois, tu fais :* derrière le banc et dans « Préparer le match », chaque patineur : « Jambes 88 Correct » + barre ; une courbe au matin ; l'onglet Jambes classe les plus usés.
*Ça change :*
- **Les canaux du moteur** — facteurEnergie = 1 − 0,5 % × (94 − jambes) sur lancers, finition, création (jusqu'à +3 % à 100
- **Blessures** — sous 60, risque × (1 + (60−j)/30
*Ça dépend de :*
- **Glace** — prix énergie), consigne, roulement, coach/patron/carte (energie), badge plombier (−40 %) : coût = 3,8 × usure²
- **Agressivité** — prix énergie), consigne, roulement, coach/patron/carte (energie), badge plombier (−40 %) : coût = 3,8 × usure²
- **Système du trio** — prix énergie), consigne, roulement, coach/patron/carte (energie), badge plombier (−40 %) : coût = 3,8 × usure²
- **Les mises en échec coûtent des jambes** — 1,2/coup
- **Le coup marquant** — −2), bagarre (−8
- récupération 50 % du manque par 2,27 jours (≈26 % un dos-à-dos), séries 50 % par match
- gestes « énergie +N » (surplus en réserve jusqu'à 30)
*Fichiers :* js/sim.js:2398-2470, js/sim.js:5948, js/gerant.js:654-683

#### Soir éreintant · `nouveau:dos-a-dos`
*Tu vois, tu fais :* 🥵 sur l'affiche et au banc.
*Ça change :*
- **Robustesse** — robustesse intensité 1 (au lieu de 0,35
- **Blessures** — blessure ×1,5
- **Jambes** — un seul jour de récupération
*Ça dépend de :*
- **Le vrai calendrier** — un des deux clubs a joué la veille
- en séries un match sur quatre
*Fichiers :* js/sim.js:5128-5129, js/sim.js:4818-4820

#### Les jambes d'un gardien · `nouveau:jambes-gardien`
*Tu vois, tu fais :* la même barre « Jambes » que les patineurs.
*Ça change :*
- buts accordés +1 % par 5 points perdus (usureGardien)
*Ça dépend de :*
- **Le dé du pari** — départs de suite (3 libres, puis −5 par départ, plancher 40
- **Le dé du pari** — une soirée de congé rend tout
- gestes `_aine`
*Fichiers :* js/sim.js:3833-3846, js/sim.js:5962

#### Effets temporaires des dilemmes et… · `moments`
*Tu vois, tu fais :* « Ce qui joue sur ta formation » (nom, puces, N matchs) ; « En cours : … » sur l'affiche.
*Ça change :*
- **Les canaux du moteur** — moteur-canaux finition/défense/volume/discipline/blessure/robustesse et minutes F/D (« Doubler le trio en feu » F [1,25 1,02 0,95 0,72]) pendant N matchs
- **Réservistes** — reserve), auxiliaire imposé (gardien-rotation), jambes
- **Cases « Partant** — reserve), auxiliaire imposé (gardien-rotation), jambes
- **Jambes** — reserve), auxiliaire imposé (gardien-rotation), jambes
*Ça dépend de :*
- **Les événements** — raté : usure ×1,12, 10 matchs
- **Trois défaites de suite** — raté : usure ×1,12, 10 matchs
- **Le proprio fixe ses attentes** — raté : usure ×1,12, 10 matchs
*Fichiers :* js/sim.js:2505-2512, js/sim.js:2574, js/sim.js:2887-2909, js/sim.js:2928, js/gerant.js:799-821

#### Préparer le match · `nouveau:preparer-match`
*Tu vois, tu fais :* En face (systèmes de leurs 2 premières lignes, ou le dépistage), « Ce soir : » les totaux, ce qui joue sur ta formation, la consigne, Devant le filet, 4 onglets de ligne (systèmes, agressivité, glace, joueurs avec rôle demandé ✓/✗, jambes, « −N » d'usure ce soir) ; « Appliquer — la saison reprend ici ». les lignes (système, agressivité, glace), la consigne 😌 Basse / 🎚️ Normale / 🌡️ Haute, « Devant le filet ce soir », les totaux du soir et l'usure. « Appliquer — la saison reprend ici ».
*Ça change :*
- **Consigne du match** — une décision `{ jour, lignes, match, filet }`
- **Système du trio** — une décision `{ jour, lignes, match, filet }`
- **Agressivité** — une décision `{ jour, lignes, match, filet }`
- **Glace** — une décision `{ jour, lignes, match, filet }`
- **Cases « Partant** — une décision `{ jour, lignes, match, filet }`
- **Consigne du match** — décision {match:{importance, ad}} pour UN soir
- **Système du trio** — décision {lignes}
- **Agressivité** — décision {lignes}
- **Glace** — décision {lignes}
- **Cases « Partant** — {filet}
- le totaux du soir se recalcule (totauxDuSoir)
*Ça dépend de :*
- **Punitions** — volume, finition, défense, discipline seulement, bornés
- **Les mises en échec coûtent des jambes** — coutsDuSoir, réserve déduite, sans les coups
- **🔎 Le dépistage : leur plan probable » et la…** — depistage/pronostic
- **Le dépistage du match** — depistage/pronostic
- **Avant le match » : la main** — deck-match
- **🔎 Le dépistage : leur plan probable » et la…** — en gros match, les indices « tu étouffes » lisent le plan le plus probable (planProbable
- **Cartes d'effet de saison** — les effets en cours sont listés
- **Les événements** — les effets en cours sont listés
- **Le dé du pari** — les effets en cours sont listés
- défaut : Normale en saison, même en gros match, mais Haute en séries
*Fichiers :* js/gerant.js:822-1025, js/saison.js:2801-2822, js/saison.js:3727-3749, js/sim.js:6728-6814 ; js/saison.js:2801-2822, 3727-3750 ; js/gerant.js:822-1012

#### Derrière le banc · `nouveau:derriere-le-banc`
*Tu vois, tu fais :* journée N sur 186, fiche V-D-DP, prochain match (🥵), infirmerie, « Ce qui joue sur ta formation », « L'effectif à ce jour » (PJ, B, A, PTS, +/-, L, PUN), 🔒 sur chaque trio ; permuter/déplacer ; « Retour au match ».
*Ça change :*
- **Les 23 cases** — décision `{ jour, cases, fermeture, lignes, sel }`, dés neufs dès ce jour
- **🔒 Trio de fermeture** — décision `{ jour, cases, fermeture, lignes, sel }`, dés neufs dès ce jour
- **Système du trio** — décision `{ jour, cases, fermeture, lignes, sel }`, dés neufs dès ce jour
- **Agressivité** — décision `{ jour, cases, fermeture, lignes, sel }`, dés neufs dès ce jour
- **Glace** — décision `{ jour, cases, fermeture, lignes, sel }`, dés neufs dès ce jour
*Ça dépend de :*
- feuilles révélées seulement (compterFeuilles)
- **Jambes** — instantané du matin (jambes, chimie, apprentissage
- **Chimie** — instantané du matin (jambes, chimie, apprentissage
*Fichiers :* js/banc.js:48-147, js/banc.js:497-572

#### Onglet Jambes · `nouveau:les-menager`
*Tu vois, tu fais :* les jambes de tous au matin, la courbe, puis des propositions chiffrées par le moteur (« X en réserve », consigne Basse, un roulement, « 2e trio : 45 s, agressivité Basse »).
*Ça change :*
- **Réservistes** — reserve, consigne, roulement, glace, agressivite
- **Consigne du match** — reserve, consigne, roulement, glace, agressivite
- **Roulement** — reserve, consigne, roulement, glace, agressivite
- **Glace** — reserve, consigne, roulement, glace, agressivite
- **Agressivité** — reserve, consigne, roulement, glace, agressivite
*Ça dépend de :*
- **Jambes** — le plus usé
- jambesAVenir (rejoue les prochains matchs)
*Fichiers :* js/saison.js:2240-2300

#### Journée suivante · `journee`
*Tu vois, tu fais :* l'en-tête « Journée j / N » + fiche, rang, séquence ; un seul bouton de tête : « Journée suivante », ou « Aujourd'hui › » le matin (du résultat d'hier au soir du match), ou « ⏳ À régler avant le match (n) : … » si un message bloque. Ensuite viennent « Regarder » (ton match ce soir) et « Jusqu'à la prochaine décision ». Chaque avance passe par un habillage télé (« Journée N », le tampon Victoire/Défaite/Congé, le récit du but gagnant, ▲▼ au rang, « la une » : deux nouvelles au plus, le fil des autres pointages). Espace ou Entrée avance aussi.
*Ça change :*
- **Le vrai calendrier** — joue la journée au moment de la révéler (jouerJusqua
- **Sommaire du match** — il s'ouvre en page si l'avance a touché plusieurs matchs, un gros match, une blessure ou du courrier, sinon le résultat monte dans l'affiche
- **📥 Boîte de réception** — les messages se recalculent
- **Jambes** — récupération ENERGIE_RECUP_JOUR chaque matin
- sauvegarde : onJour garde la journée révélée
*Ça dépend de :*
- **📥 Boîte de réception** — un message bloquant remplace le bouton
- **Rapport d'entracte** — la journée s'arrête à 40:00 un soir de gros match (entracteAttendu
- **Blessures** — chacun arrête l'avance une seule fois (paliersVus, vues, situVues, accVus
- **La main de la journée N : trois cartes** — chacun arrête l'avance une seule fois (paliersVus, vues, situVues, accVus
- **Dans le vestiaire : X et Y** — chacun arrête l'avance une seule fois (paliersVus, vues, situVues, accVus
- **Sa carte change : X** — chacun arrête l'avance une seule fois (paliersVus, vues, situVues, accVus
- **Une case que personne ne remplit** — chacun arrête l'avance une seule fois (paliersVus, vues, situVues, accVus
*Fichiers :* js/saison.js:1176 (avancer), 1851 (avancerPuisResumer), 1805 (passage), 1771 (uneDuJour), 3197-3210 (bouton de tête), 2612 (dessiner)

#### Jusqu'à la prochaine décision · `nouveau:prochaine-decision`
*Tu vois, tu fais :* la saison avance un jour à la fois et le bouton affiche « J24 … J31 ». Elle s'arrête le jour même de la première chose qui demande une décision ; il n'y a pas de saut à la fin de saison.
*Ça change :*
- **Journée suivante** — avancer(1, stop, infos=false), donc une situation ou un accident ne l'arrête pas
- le dernier croisé en route est montré à la fin
*Ça dépend de :*
- **Blessures** — main du gros match), recompense-deck, nouveau:retour-blesse, entracte : ce sont les arrêts
- **Une case que personne ne remplit** — main du gros match), recompense-deck, nouveau:retour-blesse, entracte : ce sont les arrêts
- **La main de la journée N : trois cartes** — main du gros match), recompense-deck, nouveau:retour-blesse, entracte : ce sont les arrêts
- **Les événements** — main du gros match), recompense-deck, nouveau:retour-blesse, entracte : ce sont les arrêts
- **Trois défaites de suite** — main du gros match), recompense-deck, nouveau:retour-blesse, entracte : ce sont les arrêts
- **Le proprio fixe ses attentes** — main du gros match), recompense-deck, nouveau:retour-blesse, entracte : ce sont les arrêts
- **L'événement d'avant le combat** — main du gros match), recompense-deck, nouveau:retour-blesse, entracte : ce sont les arrêts
- **Avant le match » : la main** — main du gros match), recompense-deck, nouveau:retour-blesse, entracte : ce sont les arrêts
*Fichiers :* js/saison.js:1722-1754

#### Le vrai calendrier · `calendrier`
*Tu vois, tu fais :* « Match 12 · ce soir / demain / dans 3 jours », « à domicile / chez X ». Un congé donne le tampon « Congé » avec le plus gros pointage de la ligue, et l'étape « Match » grisée (« Ton match n'est pas ce soir »). « 🥵 Dos-à-dos — la robustesse pèse ce soir ». Club › Saison montre le calendrier en semaines de 7 jours (écusson, @, pointage, marques 🏢🃏❓💬⚔️) et « La route de la saison ».
*Ça change :*
- **Robustesse** — un soir éreintant (soirEreintant) pèse 7,3 % de finition
- **Jambes** — récupération par jour (ENERGIE_RECUP_JOUR = 1-(1-0,5)^(82/186
- toutes les dates d'événements : elles se disent en matchs du club et tombent la veille du match si c'est un congé (jourEvenement)
- durées d'effets : comptées en matchs (apresMatchs, matchsEntre)
*Ça dépend de :*
- **Le dé du pari** — N = round(rondes × 186/82), donc plus de 186 jours avec un nombre impair de clubs
*Fichiers :* js/sim.js:2387-2388, 5764-5822 ; js/saison.js:2168-2197 (calendrierFiche, routeFiche), 572-587 (routeHtml), 2746-2753

#### Aperçu · `nouveau:etapes-du-soir`
*Tu vois, tu fais :* une barre de 4 étapes (l'étape courante en or, ✓ pour celles qui sont faites). Le matin montre hier (résultat, « drame » : bagarres, coups marquants, blessés, « Sommaire › ») ; le soir montre l'affiche (forces, totaux du soir, « En cours : … »).
*Ça change :*
- **Le dépistage du match** — Aperçu ouvre le dépistage
- **Préparer le match** — Préparation
- **Regarder le match** — Match lance « Regarder » s'il n'y a ni message bloquant ni congé
*Ça dépend de :*
- **📥 Boîte de réception** — blocage), calendrier (congé
*Fichiers :* js/saison.js:1283-1310, 2714-2799

#### Le dépistage du match · `pronostic`
*Tu vois, tu fais :* une barre « X % / Y % », « % en prolongation », « Buts attendus », « 300 matchs rejoués par le moteur ». Le tableau des forces en rangs avec ◀ ▶ (Attaque, Défense, Gardien ce soir, Robustesse, Vitesse, plus AN et infériorité dès 3 matchs), « 👀 Chez eux : <buteur> ». Sur l'affiche : « Forces cette saison / sur papier », « Ce qui devrait décider ».
*Ça change :*
- rien en soi. Il est calculé au toucher et mis en cache par graine|jour|décisions
*Ça dépend de :*
- la vraie saison (feuilles) dès 3 matchs, sinon strength (rangs « sur papier »)
- **Le dé du pari** — l'avantage s'affiche à partir d'un écart de max(3, n/8) rangs
- **Cases « Partant** — le partant du soir
*Fichiers :* js/saison.js:1385-1392, 1400-1477, 1505-1551 ; js/pronostic.js:116

#### 🧭 Ce que tu peux faire ce soir · `nouveau:conseils`
*Tu vois, tu fais :* 0 à n conseils chiffrés (contrer leur système, échapper à leur contre, meilleur fit, trio de fermeture, agressivité selon la carrure, glace −15 s si les jambes sont sous 88, « Consigne : attaque/défense »), chacun avec « Appliquer ».
*Ça change :*
- **Système du trio** — une décision du soir du match
- **🔒 Trio de fermeture** — une décision du soir du match
- **Agressivité** — une décision du soir du match
- **Glace** — une décision du soir du match
- **Consigne du match** — une décision du soir du match
- la saison reprend d'ici
*Ça dépend de :*
- **Fit** — snap.energie), chimie adverse, les rangs du pronostic
- **🪨 Costaud** — snap.energie), chimie adverse, les rangs du pronostic
- **Jambes** — snap.energie), chimie adverse, les rangs du pronostic
*Fichiers :* js/pronostic.js:296-424 ; js/saison.js:1535-1564

#### 📥 Boîte de réception · `boite`
*Tu vois, tu fais :* des messages par expéditeur : 🩺 Le médecin (blessure), 📋 Le DG (palier, case vide, pack, récompense), 🏢 Le proprio (objectif, verdict), 🧑‍🏫 L'entraîneur (dilemme, séquence, avant-match, retour, situation, accident, mouvements, pari), 🔎 Le dépisteur (main du combat, rapport aux 10 matchs). « À traiter », « Nouveau », « Archiver ». Un choix forcé s'ouvre seul en plein écran ; « Plus tard » le laisse dans la boîte.
*Ça change :*
- **Journée suivante** — un message bloquant retire « Journée suivante », « Regarder » et « Jusqu'à la prochaine décision ». La boîte n'est gardée que dans la page (BOITES
- rien n'en va dans la sauvegarde
*Ça dépend de :*
- **Le dé du pari** — tout est déduit de l'état. Ordre des choix forcés : récompense → verdict → objectif → séquence → dilemme → avant-match → main
- **Les événements** — tout est déduit de l'état. Ordre des choix forcés : récompense → verdict → objectif → séquence → dilemme → avant-match → main
*Fichiers :* js/saison.js:2841-2847, 2874-2981, 2995-3156, 3159-3311

#### Les événements · `dilemme`
*Tu vois, tu fais :* un plein écran « Événement » (« Événement · Règlement » si l'option contourne une règle), l'année IRL, le récit avec les vrais chiffres, le joueur visé nommé avec sa ligne, 2 à 4 options en puces chiffrées avec leur durée. Une option peut être un cadeau, un moindre mal, un pari, un investissement, un geste réel ou une mutation.
*Ça change :*
- **Punitions** — finition, volume, defense, discipline, blessure, robustesse, energie, F/D) pendant DUREE_MOMENT = 10 matchs (ou la durée de l'option
- **Blessures** — finition, volume, defense, discipline, blessure, robustesse, energie, F/D) pendant DUREE_MOMENT = 10 matchs (ou la durée de l'option
- **Robustesse** — finition, volume, defense, discipline, blessure, robustesse, energie, F/D) pendant DUREE_MOMENT = 10 matchs (ou la durée de l'option
- **Le dé du pari** — finition, volume, defense, discipline, blessure, robustesse, energie, F/D) pendant DUREE_MOMENT = 10 matchs (ou la durée de l'option
- **🧬 Modif de joueur** — mutation
- nouveau:absents (rappel du club-école)
- **Cases « Partant** — gardienAux
- **Jambes** — action.energie
- **Le dé du pari** — pari
*Ça dépend de :*
- JOURS_MOMENTS = [14,25,33,51,60,70] matchs
- **Effets temporaires des dilemmes et…** — tirage seulement si les faits sont vrais (MOMENTS[c].faits
- jamais le soir d'un gros match (attend le lendemain)
- jamais deux fois le même
*Fichiers :* js/sim.js:2548-2880, 2982-3003, 7722-7746 ; js/saison.js:896-950, 2938-2955

#### Trois défaites de suite · `sequence`
*Tu vois, tu fais :* un événement forcé de l'entraîneur avec 4 options (brasser la glace, garder le cap, huis clos avec pari, briser le règlement / doubler le 1er trio…).
*Ça change :*
- **Roulement** — minutes F/D), defense, discipline, blessure, robustesse pendant DUREE_SEQUENCE = 8 matchs
- **Le dé du pari** — huis clos 50 %
*Ça dépend de :*
- seuils 3 D / 4 V
- une fois par saison chacune
- RECUL_SEQUENCE = 10 matchs entre deux
- le titre suit la vraie longueur
*Fichiers :* js/sim.js:2887-2912 ; js/saison.js:957-979, 2928-2937

#### Le dé du pari · `de`
*Tu vois, tu fais :* une option qui porte un pari ouvre la scène du dé : « 🎲 Ça passe sur 4, 5 ou 6 », puis « Lancer le dé », la face, « ça passe ! / raté. », les puces de l'issue et « Continuer » (« Autre réponse » avant de lancer). Le message « 🎲 … : le pari a payé » reste dans la boîte tant que l'effet court.
*Ça change :*
- la décision prend son sel au lancer
- l'effet gagne ou perd (canaux, durée)
- team.paris alimente l'histoire
*Ça dépend de :*
- **Les événements** — avant-match. Faces = round(chance×6) (facesDuPari), le tirage est hacherMise(graine, jour, choix, sel
- **Trois défaites de suite** — avant-match. Faces = round(chance×6) (facesDuPari), le tirage est hacherMise(graine, jour, choix, sel
- **L'événement d'avant le combat** — avant-match. Faces = round(chance×6) (facesDuPari), le tirage est hacherMise(graine, jour, choix, sel
*Fichiers :* js/gerant.js:376-440 ; js/sim.js:7754-7777 ; js/saison.js:2891-2895, 3141-3148

#### Dans le vestiaire : X et Y · `situation`
*Tu vois, tu fais :* un message non bloquant qui nomme un joueur PORTÉ (🔥 En feu, 🎯 Le déclic, 🏠 Chez lui, 👶 Premier enfant, 📝 Année de contrat, 🧱 Un mur pour l'auxiliaire) et un PESÉ (🌧️ Panne sèche, 💤 Creux, 🗞️ Rumeur, 🛫 Voyages, 🧊 Amoché, 🕳️ La passoire pour le partant), en mots seulement. Bouton « Revoir mon alignement ».
*Ça change :*
- **Blessures** — lancers, finition, creation, gardien, blessure de ces deux joueurs (le pesé ×1,3 sur l'écart, ECHELLE_PESE) jusqu'à la fenêtre suivante
- toute la ligue en vit
*Ça dépend de :*
- JOURS_SITUATIONS = [10,28,46,64] matchs
- tirage sur la valeur (pas la case)
- reportée si gros match
- **Le dé du pari** — il faut au moins 8 patineurs et 2 gardiens pour une situation de gardien
*Fichiers :* js/sim.js:3121-3436, 5994-6013 ; js/saison.js:822-833, 3111-3126

#### Sa carte change : X · `accident`
*Tu vois, tu fais :* un message non bloquant avec la mutation (nom, quoi, puces chiffrées).
*Ça change :*
- **🧬 Modif de joueur** — la mutation « accident » pour le reste de la saison (profils, donc fit et chimie ; lancers, finition, défense, blessure
*Ça dépend de :*
- JOURS_ACCIDENTS = [7,22,37,55,74] matchs, CHANCE_ACCIDENT = 0,5, un patineur habillé
- reporté si gros match
*Fichiers :* js/sim.js:6618-6631 ; js/saison.js:829-831, 3102-3110

#### Le proprio fixe ses attentes · `objectif-proprio`
*Tu vois, tu fais :* trois défis pour tes 20 prochains matchs (11 V, 58 BC ou moins, 64 BP, 4 V de suite, un joueur à 21 pts, 2 blanchissages, jamais 3 D de suite). Chacun porte « Probable / Jouable / Coriace / Très dur · ~n chances sur 10 » et une raison tirée de tes vrais chiffres. Une jauge suit dans Club › Saison (« val / cible · n/20 matchs »). Au verdict : « Objectif atteint » (une carte parmi 3) ou « Objectif raté » (« Encaisser »).
*Ça change :*
- **Cartes d'effet de saison** — réussi, mainDeCartes(graine, 2000+j0
- **Jambes** — raté, OBJECTIF_RATE energie ×1,12 pendant 10 matchs
- **Les malédictions** — raté, « La distraction » ajoutée au deck
- **🪙 N jetons** — +20 en Rogue
*Ça dépend de :*
- JOURS_OBJECTIFS = [0,41]
- MATCHS_OBJECTIF = 20
- chancesDesObjectifs (30 chemins)
- réussi peut tomber avant la fin pour une mesure qui monte
*Fichiers :* js/sim.js:2914-2974 ; js/saison.js:980-999, 1618-1646, 2590-2601, 2896-2927 ; js/combat.js:385-386 ; js/pronostic.js:464-518

#### La main de la journée N : trois cartes · `main-journee`
*Tu vois, tu fais :* un message DG bloquant (trois dos de carte), puis un plein écran « Trois cartes, trois sortes » : toujours un effet, plus 2 sortes tirées parmi recrue, amélioration, nouveau rôle, stage, ménage, camp, atelier. Un contexte « Déjà en jeu ». « Plus tard ». Si on finit la saison sans choisir, l'offre revient à l'écran de fin.
*Ça change :*
- selon la sorte (blocs ci-dessous). C'est une décision datée du soir du prochain match (soirDuProchain) qui porte son palier
*Ça dépend de :*
- PALIERS_CARTES = [20,40,60] matchs
- mainDuDeck(graine, palier, dejaPrises)
- une carte déjà prise ne revient pas
*Fichiers :* js/sim.js:3012-3101 ; js/saison.js:789-812, 2415-2553, 3046-3056, 2636-2641

#### Joueur au choix · `nouveau:palier-recrue`
*Tu vois, tu fais :* trois vrais joueurs (avant, défenseur, gardien) de clubs absents de ta ligue, en cartes ; « Signer », puis « qui sort ? » dans l'alignement.
*Ça change :*
- **Vestiaire » : le bassin** — il arrive en case de réserve
- **Plafond restant » 95,5 M$** — plafond
- **(ce que le repêchage y envoie)** — la carte de celui qui sort
- **Au ballottage** — décision {deck:'recrue', ballottage}
*Ça dépend de :*
- **Le montant sur la carte** — budget = espace sous le plafond + salaire du sortant
- **Plafond restant » 95,5 M$** — 8 meilleurs producteurs (gp ≥ 40, 20 pour un gardien), désactivé si « Personne ne rentre sous ton plafond »
*Fichiers :* js/banc.js:345-402 ; js/saison.js:2439-2441, 2473-2486

#### Amélioration » et « L'atelier · `nouveau:palier-amelioration`
*Tu vois, tu fais :* une amélioration, ou trois éditions de l'atelier ; on en garde une, qui va à l'inventaire, « se pose au verso » plus tard.
*Ça change :*
- **🧬 Modif de joueur** — modif-joueur, mais seulement une fois posée (une décision `garde`, sans dés neufs
- Rogue : l'amélioration grandit avec echelleTardive
*Ça dépend de :*
- editionsDuJour
- **(ce que le repêchage y envoie)** — cartable et inventaire pour la poser
- **Ton inventaire** — cartable et inventaire pour la poser
*Fichiers :* js/saison.js:2442-2451, 2495-2502 ; js/banc.js:213, 292

#### Nouveau rôle · `nouveau:palier-profil`
*Tu vois, tu fais :* trois conversions (joueur et sa ligne) ; « Choisir ».
*Ça change :*
- **🧬 Modif de joueur** — source choix) : son rôle, donc fit et chimie, pour de bon
*Ça dépend de :*
- rolesOfferts / cibleMutation
- désactivé si « Personne à convertir »
*Fichiers :* js/saison.js:2447-2449, 2503-2512

#### Stage de système · `nouveau:palier-stage`
*Tu vois, tu fais :* 2 systèmes de trio et 1 de paire, « Tes avants : le connaissent bien / un peu… », « Taillé pour ta 2e paire ».
*Ça change :*
- **📘 Maîtrise des systèmes** — +40 % du chemin (GAIN_STAGE 0,4) pour avants ou défenseurs
- **🤝 Entente** — +12 matchs par paire de coéquipiers des lignes qui le jouent (Rogue seulement, ENTENTE_STAGE
*Ça dépend de :*
- apprentissage du jour (jourLignes), fitUnite
*Fichiers :* js/sim.js:3036-3066, 5551-5563 ; js/saison.js:2531-2552

#### Le ménage du vestiaire · `nouveau:palier-menage`
*Tu vois, tu fais :* choisir une carte du deck de match à retirer (les malédictions d'abord).
*Ça change :*
- **Avant le match » : la main** — retrait après tous les ajouts (une cicatrice peut sortir
- **Le dé du pari** — pas de dés neufs
*Ça dépend de :*
- deckAvant(jour)
*Fichiers :* js/saison.js:2522-2530 ; js/combat.js:379-406

#### Le camp d'entraînement · `nouveau:palier-camp`
*Tu vois, tu fais :* choisir la carte qui devient « + » (on voit la version améliorée).
*Ça change :*
- **Avant le match » : la main** — la carte devient sa version « + » (moitié plus forte, ou un élan de moins
*Ça dépend de :*
- désactivé si « Tout ton deck est déjà amélioré »
*Fichiers :* js/saison.js:2452-2454, 2514-2521 ; js/combat.js:307-360, 384

#### Cartes d'effet de saison · `carte-saison`
*Tu vois, tu fais :* une carte « + bon / − prix » (Bloc de départ, Le cadenas, L'infirmerie, La vague…), prise à un palier, au verdict d'un objectif réussi, ou tirée sur une case vide. Elle est listée dans « Déjà en jeu », dans les totaux du soir et au bilan (« Tes cartes »). au classeur de la banque, « Toute la saison », « ⚡ Jouée immédiatement ».
*Ça change :*
- **Blessures** — finition, defense, volume, blessure, discipline, robustesse de l'équipe pour le reste de la saison ET en séries (effetsDeSaison
- **Punitions** — finition, defense, volume, blessure, discipline, robustesse de l'équipe pour le reste de la saison ET en séries (effetsDeSaison
- **Robustesse** — finition, defense, volume, blessure, discipline, robustesse de l'équipe pour le reste de la saison ET en séries (effetsDeSaison
- **Les canaux du moteur** — payload {carte}
*Ça dépend de :*
- **La main de la journée N : trois cartes** — case-vide
- **Le proprio fixe ses attentes** — case-vide
- **Une case que personne ne remplit** — case-vide
- « une carte ne se prend qu'une fois »
- **La main de la journée N : trois cartes** — aucun pack de cartes n'en contient
*Fichiers :* js/sim.js:1002-1180, 1249-1270, 5515 ; js/banc.js:481-487 ; js/banque.js:45, 466, 569 ; js/packs.js:128-139

#### Au ballottage · `ballottage`
*Tu vois, tu fais :* trois rappels du club-école en cartes (portrait, salaire, rareté), « moins bons que lui », « (10 🪙) » en Rogue ; « Signer », puis « qui sort ? » ; « Garder mon alignement ».
*Ça change :*
- **Vestiaire » : le bassin** — il prend la case du blessé, et le blessé descend en réserve
- **(ce que le repêchage y envoie)** — le réserviste qui sort va au cartable
- **Plafond restant » 95,5 M$** — plafond
- **🪙 N jetons** — jetons −10 en Rogue
*Ça dépend de :*
- RAPPEL_MATCHS = [5,30] matchs dans sa saison
- production inférieure à celle du blessé
- NIVEAU_MAX = Régulier
- **Plafond restant » 95,5 M$** — budget min(espace + sortant, 3 % du plafond
- mêmes saisons que la ligue, clubs absents
*Fichiers :* js/ballottage.js:26-125 ; js/banc.js:309-344 ; js/saison.js:3245-3271

#### X revient : l'alignement d'avant ? · `nouveau:retour-blesse`
*Tu vois, tu fais :* un message bloquant qui liste l'alignement d'avant la blessure ; « Remettre comme avant » ou « Garder l'alignement actuel ».
*Ça change :*
- **Les 23 cases** — case-alignement plus la fermeture et les lignes de la décision d'avant
*Ça dépend de :*
- **Blessures** — un remaniement depuis la blessure
- RETOUR_FENETRE = 3 matchs après le retour
*Fichiers :* js/saison.js:1098-1150, 3088-3101, 3285-3293

#### N changements dans ton alignement · `nouveau:mouvements`
*Tu vois, tu fais :* « 🔁 J12 X monte : 2e trio · AD à la place de Y, blessé ».
*Ça change :*
- rien, c'est une information
*Ça dépend de :*
- activeLineup (le premier réserviste compatible monte)
*Fichiers :* js/saison.js:1347-1377, 3127-3134

#### Rapport après n matchs : forces et faiblesses · `nouveau:rapport-depisteur`
*Tu vois, tu fais :* tous les 10 matchs : « Ce qui marche / Ce qui coule » (le quart haut et le quart bas des 7 mesures), les buts et tirs de tes lignes à forces égales, 🔥 chaud et 🥶 froid sur 10 matchs ; « Revoir mes lignes ».
*Ça change :*
- rien, sauf qu'il mène au banc
*Ça dépend de :*
- les feuilles révélées
*Fichiers :* js/saison.js:1566-1610, 3149-3154

#### Club › Jambes · `nouveau:menagements`
*Tu vois, tu fais :* la liste « Les jambes · au matin de la journée N » (les plus usés d'abord, avec leur courbe), puis des propositions avec « ±x jambes à lui / en moyenne / à ta 1re ligne / au trio » et « Appliquer » : un joueur en réserve, la consigne Basse, un roulement, la ligne la plus usée à −15 s et agressivité basse.
*Ça change :*
- **Les 23 cases** — une décision
- **Consigne du match** — une décision
- **Roulement** — une décision
- **Glace** — une décision
- **Agressivité** — une décision
*Ça dépend de :*
- **Jambes** — jourLignes), jambesAVenir (6 rejeux
*Fichiers :* js/saison.js:2226-2300, 2393-2400

#### 🔮 La prévision du moteur · `nouveau:prevision`
*Tu vois, tu fais :* « Lancer la prévision » → « n points en fin de saison (de a à b) », buts pour et contre par match, les points projetés des joueurs.
*Ça change :*
- rien (le calcul est isolé)
*Ça dépend de :*
- prevision (8 saisons rejouées)
- il se refait après une décision
*Fichiers :* js/saison.js:2198-2225, 2382-2392 ; js/pronostic.js:156

#### Club › Saison · `nouveau:etat-saison`
*Tu vois, tu fais :* « 💀 La run » (mandat, barème des jetons), « 📋 Tes coachs I/II/III », « 🏢 Le proprio » (jauge), « 🚑 Infirmerie », la prévision, la route, le calendrier, « 📖 Ton histoire » en 3 actes (matchs 1, 29, 57) avec « ⚔️ Ta rivalité », « Tes n matchs ».
*Ça change :*
- rien
*Ça dépend de :*
- **Le proprio veut : faire les séries** — mandat, coach, confiance, objectif-proprio, minisBoss, décisions, paris, mutations
- **Ton coach** — mandat, coach, confiance, objectif-proprio, minisBoss, décisions, paris, mutations
- **Confiance I** — mandat, coach, confiance, objectif-proprio, minisBoss, décisions, paris, mutations
- **Le proprio fixe ses attentes** — mandat, coach, confiance, objectif-proprio, minisBoss, décisions, paris, mutations
*Fichiers :* js/saison.js:2051-2117, 2555-2610, 2301-2312

#### Les tuiles du bureau · `nouveau:portail`
*Tu vois, tu fais :* Classement (autour de toi), « Tes 5 prochains », « Tes meneurs », « Ton deck · n cartes · 3 d'élan par main · n malédictions ».
*Ça change :*
- rien (elles mènent aux onglets ou au deck)
*Ça dépend de :*
- **Avant le match » : la main** — deck-match, malediction
- **Les malédictions** — deck-match, malediction
*Fichiers :* js/saison.js:2007-2039

#### Classement · `nouveau:ligue-ecrans`
*Tu vois, tu fais :* le classement du jour (PJ V D DP PTS BP BC Diff Séq. « 10 derniers », la coupure « les 16 premiers vont en séries »), les résultats de la journée, les meneurs triables (Patineurs / Gardiens), n'importe quel club à ce jour (blessés 🩹, « Retiré de l'alignement »). En séries : le Tableau, Ma série, La ronde, et la saison régulière dessous.
*Ça change :*
- rien
*Ça dépend de :*
- les feuilles révélées seulement (compterFeuilles)
- tri PTS, V, diff, BP
*Fichiers :* js/saison.js:339-562, 2041-2049, 2331-2352, 3830-3947

#### La règle de reprise · `nouveau:decision-datee`
*Tu vois, tu fais :* chaque choix ferme l'écran et le rouvre à la même journée (le voile « On rejoue la saison avec ton choix… » seulement si un jour déjà joué est touché) ; un toast confirme ce qui vient d'être fait.
*Ça change :*
- **Le dé du pari** — la décision entre dans G.ligue.decisions et porte son sel (dés neufs à partir de son jour
- **Le dé du pari** — si elle remplace une décision du même palier ou du même soir, le moteur en mémoire est réutilisé, sinon tout est rejoué de la graine et des dés gardés (L.des). Une décision « deck seul » (récompense, ménage, camp, garde, achat) n'a pas de sel
*Ça dépend de :*
- **Le dé du pari** — toutes les décisions de ce domaine
- deDuJour (les dés du matin et du soir sauvegardés)
*Fichiers :* js/banc.js:185-249, 431-473 ; js/sim.js:5927-5943, 6019-6049

#### Confiance I · `confiance`
*Tu vois, tu fais :* à l'onglet « Tes coachs » de l'inventaire, une jauge par coach avec ses crans à 3, 6 et 9, « encore N pour II », et les puces de « Joue : » et du palier suivant. Au hub, une ligne « 📋 Tes coachs ». Tu joues des cartes d'une couleur pour monter.
*Ça change :*
- **Les canaux du moteur** — un `coach` lu comme un patron dans effetsDeSaison, séries comprises : volume 1.05/1.10/1.17, finition, defense 0.96/0.93/0.88, robustesse, discipline, blessure, energie, minutes F
- **La boutique** — le Comptable : rabais 0.92/0.86/0.80, +2/+3 🪙 par victoire, plafond +5 % au III
- **🪙 N jetons** — le Comptable : rabais 0.92/0.86/0.80, +2/+3 🪙 par victoire, plafond +5 % au III
- **📘 Maîtrise des systèmes** — au II, décision `maitrise` {tac: systeme, gain 0.35}
- **💵 Masse salariale** — le Comptable au III, une ligne au plafond
- **Plafond restant » 95,5 M$** — le Comptable au III, une ligne au plafond
*Ça dépend de :*
- **🐝 Le Frelon** — buildDe compte les `joue.id` et les `recompense`
- **Ton coach** — 3 au départ
- **Sa confiance joue ×1,6** — porte-par-ses-joueurs
- **Ce qui te suit aussi… Ce qui expire…** — coachsDeBase et coach rejoués au jour 0
*Fichiers :* js/coachs.js:52, 130-132, 205-210 ; js/banque.js:776-828 ; js/banc.js:211-212 ; js/inventaire.js:159-181 ; js/saison.js:2581-2588

#### 🪙 N jetons · `jetons`
*Tu vois, tu fais :* le compte dans la barre, dans la boutique et dans l'inventaire ; au hub, le barème « 🪙 Victoire 5 · prolongation 4 · défaite 2 · gros match +20 · objectif +20 · ronde de séries +40 ». Tu les dépenses à la boutique.
*Ça change :*
- **La boutique** — packs, Ton club
- **Au ballottage** — une réclamation coûte 10 🪙 en Rogue
- **💵 Masse salariale** — rachat −10 🪙, club-école −5 🪙
*Ça dépend de :*
- résultats (révélés)
- **Combat** — gagné
- **Le proprio fixe ses attentes** — carte prise au verdict `v:`
- **Séries éliminatoires** — rondes
- **Le vestiaire des déblocages** — caisse1/2 +20/+20 au départ ; commanditaire1/2 : 5 → 8 → 10 par victoire, barème fixé au départ de chaque saison
- **L'adjoint joue cette série** — jetonsVictoire), confiance du Comptable
- **🧴 Consommable » et sa cible** — enveloppe +20, coffre +45, billet 50 % : +30, pari 35 % : +50, dépanneur +12
- **📰 Événement** — commanditaires +8, +3 par carte
- **Vendre** — revente. Tout se déduit des décisions. En mode Saison, on part de 0 au barème JETONS (8 par victoire
*Fichiers :* js/rogue.js:42-53, 75 ; js/rogue-jeu.js:69-120 ; js/banc.js:324-325 ; js/saison.js:2568-2578

#### 📰 Événement · `evenement-carte`
*Tu vois, tu fais :* une carte gardée dans « Cette saison », qu'on joue : un bonus et son prix pour 3 à 15 matchs, parfois « Règlement ».
*Ça change :*
- **Les canaux du moteur** — effet temporaire, fin = apresMatchs
- **Jambes** — gestes : energieTous, soin
- **Blessures** — gestes : energieTous, soin
- **🪙 N jetons** — gain
*Ça dépend de :*
- **Pack Personnel** — pack-cartes
- **Tirs +0,4 % par carte 🐝 du Frelon jouée** — 9 événements de coach, échelle au plus 8
*Fichiers :* js/banque.js:232-304, 729-733

#### 🧬 Modif de joueur · `modif-joueur`
*Tu vois, tu fais :* « Jouer » ouvre l'alignement, et chaque case dit ce que la carte ferait ou pourquoi elle ne peut pas aller là. On touche un joueur, son verso s'ouvre, on « Pose ici ».
*Ça change :*
- **Icônes 🛡️ Selke** — mutation du joueur
- **🎯 Sniper Or** — mutation du joueur
- **Glace** — mutation du joueur
- **Carton Base** — le lustre fait monter la carte
- **(ce que le repêchage y envoie)** — en Rogue, améliorations, styles, contrats et atelier restent sur la carte, d'une run à l'autre
*Ça dépend de :*
- **Carton Base** — cases du verso (2 ; holo ou or : 3 ; le lustre change la variante et donc le nombre de cases
- **Le dé du pari** — cases du verso (2 ; holo ou or : 3 ; le lustre change la variante et donc le nombre de cases
- gardien ou patineur
- **L'échelle du soir des cartes** — les améliorations grandissent
*Fichiers :* js/banque.js:370-420 ; js/rogue-jeu.js:497-498, 556-582, 1154-1178 ; js/cartable.js:116-127

#### 🧴 Consommable » et sa cible · `consommable`
*Tu vois, tu fais :* « Jouer » ouvre la bonne liste (« qui soigner ? », « pour qui ? », une malédiction du deck, une carte à améliorer, un système) ; « Personne à l'infirmerie : garde-la ».
*Ça change :*
- **Blessures** — soin −2 à −12 matchs
- **Jambes** — +15 à +40, ou tous +6 à +20
- **Cases « Partant** — gardienAux 3 ou 5
- **Avant le match » : la main** — retrait d'une malédiction, aiguise en « + »
- **📘 Maîtrise des systèmes** — +15 ou +25 %
- **Glace** — minutes F
- **🪙 N jetons** — gain, pari
- **Les canaux du moteur** — moteur-canaux
*Ça dépend de :*
- vie (usage = cette saison ; permanent = méta, qui le perd quand on le joue)
- **Tirs +0,4 % par carte 🐝 du Frelon jouée** — cartes de vestiaire : +par joueur de la couleur, au plus 5
*Fichiers :* js/banque.js:313-368, 735-751 ; js/rogue-jeu.js:499-532

#### 💵 Masse salariale · `contrat`
*Tu vois, tu fais :* « Jouer », puis un joueur avec « 5 M$ → 2,5 M$ », ou un blessé (« hors du plafond »), ou une recrue de 23 ans ou moins. « Il faut 10 🪙 pour ce rachat. »
*Ça change :*
- **Plafond restant …** — espace +1,5/2/3/5 M$ ; facteur de cap hit 0.5–0.9 ; LTIR à 0 tant qu'il est blessé
- **🪙 N jetons** — cout
- **Pack Bronze/Argent/Or/Premium** — salaireMax
*Ça dépend de :*
- **Blessures** — pour le LTIR
- **Ruban « Recrue** — pour « entree »
- **Le dé du pari** — la taxe de luxe (malédiction, −3 M$, frappe à l'ouverture d'un Pack Contrats 8 % ou d'un Lot 10 %
*Fichiers :* js/banque.js:181-228, 752-757 ; js/rogue-jeu.js:533-553 ; js/packs.js:449-455

#### Tirs +0,4 % par carte 🐝 du Frelon jouée · `nouveau:carte-qui-grandit`
*Tu vois, tu fais :* une puce de plus sur 9 adjoints, 9 événements et 8 consommables de vestiaire.
*Ça change :*
- **L'adjoint joue cette série** — l'effet écrit dans la décision
- **📰 Événement** — l'effet écrit dans la décision
- **🧴 Consommable » et sa cible** — l'effet écrit dans la décision
*Ça dépend de :*
- **Confiance I** — le compte de buildDe
- **Sa confiance joue ×1,6** — joueursDesCoachs
*Fichiers :* js/banque.js:127-144, 270-278, 359-366, 696-708

#### Ton inventaire · `nouveau:inventaire`
*Tu vois, tu fais :* la barre « 💵 Masse salariale » avec ses lignes, des cartes en piles « Jouer / Au deck / Vendre · N 🪙 / Engager ».
*Ça change :*
- **L'adjoint joue cette série** — chaque jeu est une décision du jour
- **🧴 Consommable » et sa cible** — chaque jeu est une décision du jour
- **💵 Masse salariale** — chaque jeu est une décision du jour
- **🧬 Modif de joueur** — chaque jeu est une décision du jour
- **📰 Événement** — chaque jeu est une décision du jour
- **Avant le match » : la main** — chaque jeu est une décision du jour
- **Vendre** — revente
*Ça dépend de :*
- **Pack Personnel** — pack-cartes
- **Un pack Mixte gratuit** — pack-palier
- **La main de la journée N : trois cartes** — `garde`
- en Rogue, la méta (personnel, permanents)
*Fichiers :* js/inventaire.js:40-64, 108-223 ; js/rogue-jeu.js:416-457

#### Un pack Mixte gratuit · `nouveau:pack-palier`
*Tu vois, tu fais :* des cartes qui apparaissent dans la poche « Cette saison ».
*Ça change :*
- **Ton inventaire** — 5 cartes non permanentes
*Ça dépend de :*
- **Journée suivante** — brute, pas en matchs
*Fichiers :* js/inventaire.js:32-33, 52-57

#### La date limite des échanges est passée · `date-limite`
*Tu vois, tu fais :* les packs de joueurs et leurs paquets scellés sont 🔒.
*Ça change :*
- **Pack Bronze/Argent/Or/Premium** — pack-joueurs
- **Garder scellé** — « il s'ouvre la saison prochaine »
*Ça dépend de :*
- les matchs joués ≥ 62
- **Au ballottage** — le ballottage reste ouvert
*Fichiers :* js/packs.js:86-92 ; js/rogue-jeu.js:151-160, 197-200

### Le match (19)

#### Une case que personne ne remplit · `nouveau:case-vide`
*Tu vois, tu fais :* une carte de saison est TIRÉE pour toi (« le vestiaire s'ajuste »). un message DG bloquant : « Aucun réserviste ne pouvait prendre la place… tu ne choisis pas celle-là », la carte tirée (+bon/−prix), « Compris ».
*Ça change :*
- **Cartes d'effet de saison** — une carte bonus+malus imposée
- **Les canaux du moteur** — la case joue au rappel (cote 40
- **Cartes d'effet de saison** — décision {carte, palier 'trou:<match>'}
- la case est jouée par un remplaçant du moteur
*Ça dépend de :*
- **Blessures** — le filet est la cause n° 1
- **Réservistes** — le filet est la cause n° 1
- **Cases « Partant** — le filet est la cause n° 1
- activeLineup ne trouve aucun réserviste compatible (environ 1,02 fois par saison)
- mainDeCartes(graine, 1000+at)
*Fichiers :* js/sim.js:5136-5144, js/banc.js:161-183 ; js/saison.js:835-865, 3032-3045 ; js/banc.js:161-183

#### Blessures · `blessure`
*Tu vois, tu fais :* « 😱 OH NON ! » au direct, 🩹 N dans la case, l'infirmerie au banc, le ballottage dans la boîte. un message bloquant si un patineur habillé manque 4 matchs ou plus : « il sort de ton alignement : qui joue sa case ? ». Boutons « 🪑 Monter un réserviste » (« Qui monte ? », avec « Hors position −n »), « 📋 Rappel : n joueurs », « Remanier derrière le banc ». Si rien ne force, « Garder mon alignement ». Un gardien n'est jamais forcé.
*Ça change :*
- **Réservistes** — un réserviste monte), nouveau:case-vide, ballottage/malediction (longue blessure), chimie (entente cassée
- **Les 23 cases** — décision {cases} (le blessé et le réserviste échangent
- **Au ballottage** — ballottage
- **−1,2** — adaptation-case et position (pénalité hors position
- **C** — adaptation-case et position (pénalité hors position
- **Cicatrices** — ≥ 15 matchs
- **X revient : l'alignement d'avant ?** — retour-blesse
*Ça dépend de :*
- **Le dé du pari** — part de matchs joués réelle (0,0015 + 0,015 × fragilité²
- gardien ×0,5
- soir éreintant ×1,5
- cote `r` cachée (ROB_BLESSURE)
- **Robustesse** — dissuasion −18 %/écart-type
- **Jambes** — jambes < 60
- **Le coup marquant** — coup-marquant ×1,5, bagarre perdue ×3
- **Consigne du match** — consigne Haute ×1,25, roulement, cartes, moments, situation, modif. Durée géométrique ~8, max 40
- BLESSURE_MOMENT = 4
- **Robustesse** — blessures −18 % par écart-type
- **Jambes** — < 60
- **Consigne du match** — consigne Haute (+25 %
*Fichiers :* js/sim.js:4811-4830, js/sim.js:5088-5112 ; js/saison.js:867, 1151-1163, 1231-1256, 3057-3087, 3272-3284

#### Les mises en échec coûtent des jambes · `coups`
*Tu vois, tu fais :* « Mises en échec » dans les stats du direct ; la règle « 1,2 jambes, 0,6 costaud, 1,8 léger ».
*Ça change :*
- **Jambes** — jambes de l'ADVERSAIRE après le match (60 % sur ses trios, 40 % sur ses paires, au poids de l'appariement
*Ça dépend de :*
- **Le dé du pari** — `ht` réels (estimés de `r` avant 2005-06) × présence × (0,6 + physique de l'agressivite
- **Agressivité** — `ht` réels (estimés de `r` avant 2005-06) × présence × (0,6 + physique de l'agressivite
- **🪨 Costaud** — carrure du frappé
*Fichiers :* js/sim.js:1861, js/sim.js:1903-1939, js/sim.js:5285

#### Le coup marquant · `nouveau:coup-marquant`
*Tu vois, tu fais :* une ligne « MISE EN ÉCHEC » au direct et au sommaire.
*Ça change :*
- **Jambes** — jambes −2 (COUP_MARQUANT_JAMBES
- **Blessures** — blessure ×1,5 ce soir (BLESSURE_SONNE
*Ça dépend de :*
- **Les mises en échec coûtent des jambes** — coups attendus × 12 %
- **🪨 Costaud** — frappeur pesé par `ht` et carrure
- **Agressivité** — agressivite
*Fichiers :* js/sim.js:1969-1971, js/sim.js:2006-2019, js/direct.js:523-529

#### Bagarre · `bagarre`
*Tu vois, tu fais :* « BAGARRE … 5 min chacun » au direct (pause 1,2 s), au sommaire.
*Ça change :*
- **Le dé du pari** — les deux hors de leurs unités 5 min (`auCachot`
- finition du club vainqueur ×1,06, perdant ×0,94, 10 min
- **Blessures** — blessure ×3 au battu
- **Jambes** — jambes −8 aux deux
- **Le dé du pari** — minutes de punition
*Ça dépend de :*
- **Agressivité** — 0,55 × punitions d'époque × (0,5 + 0,7 × (bagarreurs des deux clubs)) × agressivite
- combattant pesé score bagarreur³
- issue : rôle + 0,6 physique + gabarit + hasard
*Fichiers :* js/sim.js:1969-1970, js/sim.js:2020-2044, js/direct.js:530-539

#### Mêlée · `nouveau:melee`
*Tu vois, tu fais :* « MÊLÉE » au direct.
*Ça change :*
- **Le dé du pari** — 2 min à un de chaque bord (rien d'autre
*Ça dépend de :*
- **Agressivité** — MELEE_BASE 0,5 × époque × agressivite
- **🪨 Costaud** — carrure
*Fichiers :* js/sim.js:2045-2053

#### Robustesse · `robustesse`
*Tu vois, tu fais :* « 🥵 dos-à-dos — la robustesse pèse ce soir » sur l'affiche et au banc ; la forme « en robustesse » au dépistage.
*Ça change :*
- **Les canaux du moteur** — moteur-canaux finition : exp(0,07 × intensité × écart) (2,5 % par écart-type un soir ordinaire, 7,3 % un dos-à-dos, +0,15 d'intensité par ronde des séries
- **Blessures** — dissuasion e^(−0,2×z) (−18 %/écart-type
*Ça dépend de :*
- **Le dé du pari** — cote `r` cachée au poids de glace (teamStrength
- **Glace** — cote `r` cachée au poids de glace (teamStrength
- **Icônes 🛡️ Selke** — trait Colosse (+0,5 ; borne 1,8
- **Agressivité** — agressivite et canal « physique » des systèmes (robTac
- **Roulement** — roulement ±0,9
- **Effets temporaires des dilemmes et…** — cartes/moments
- **Soir éreintant** — dos-a-dos
*Fichiers :* js/sim.js:3555-3563, js/sim.js:4546-4547, js/sim.js:5093, js/sim.js:4908

#### Punitions · `discipline`
*Tu vois, tu fais :* puces « Punitions ±N % » sur systèmes et agressivité ; « PUNITION · 2 MIN » au direct.
*Ça change :*
- **Avantage numérique** — avantage-numerique de l'adversaire : Poisson(occasions d'époque × indiscipline), bornée 0,5–1,8
*Ça dépend de :*
- PIM réels relatifs (`punitionsRel`)
- **Système du trio** — prix discipline
- **Agressivité** — agressivite × carrure
- **Effets temporaires des dilemmes et…** — cartes/moments/coachs/entracte
- **Rapport d'entracte** — cartes/moments/coachs/entracte
- le puni est tiré parmi tous les patineurs par ses PIM réels
*Fichiers :* js/sim.js:3734-3735, js/sim.js:3879-3884, js/sim.js:4139-4152, js/sim.js:5346-5367

#### Avantage numérique · `avantage-numerique`
*Tu vois, tu fais :* « AN NHL · 85 s » au tableau, « BUT · AN », « Avantage numérique 1 / 4 » aux stats ; aucun réglage.
*Ça change :*
- **Le dé du pari** — 0,60 tir/min × volume de la 1re unité, finition ×1,35, le 1er but ferme
- désavantage 0,09 tir/min
- +/- ignore les buts AN
*Ça dépend de :*
- **Punitions** — discipline adverse
- unités AUTOMATIQUES (ppp/shp réels sinon création/cote d ; 65/35 et 60/40)
- **🎯 Sniper Or** — badge sniper
- défenseurs 38 % des tirs AN
*Fichiers :* js/sim.js:3716-3733, js/sim.js:3909-3944, js/sim.js:5360-5386

#### Action spéciale du système · `action-speciale`
*Tu vois, tu fais :* « ✓ tu étouffes ses actions spéciales » / « ⚠️ son système étouffe le tien » dans la fenêtre ; au direct, un arrêt dangereux raconté comme une séquence, ou « 🧱 DÉFENSE » si étouffée ; « a réussi N actions spéciales » au sommaire.
*Ça change :*
- un lancer FE du trio entre ×1,8 (SPEC_MULT)
- toute la finition FE ×0,88 (SPEC_NORME)
*Ça dépend de :*
- **Chimie** — 0,22 × c/100
- **Système du trio** — systeme ≠ Hourra
- trio OU paire qui défend avec `bat` = ton système
- **Qui joue contre qui** — qui défend
*Fichiers :* js/sim.js:2347, js/sim.js:4653-4666, js/direct.js:182-189

#### Les canaux du moteur · `moteur-canaux`
*Tu vois, tu fais :* partout en puces « Tirs / Précision / Buts contre / Punitions / Blessures / Usure des jambes / Robustesse / 1er trio : glace » (motsDEffet).
*Ça change :*
- volume → pression (borne 1,35×REF)
- finition → finitionFacteur (≤ 1,20/finEquipe)
- défense → traitDef
- **Punitions** — discipline → mineures
- **Robustesse** — robustesse → K_ROB
- **Blessures** — blessure → applyInjuries
- énergie → kUsure
- F/D → partsDuRoulement
*Ça dépend de :*
- **Cartes d'effet de saison** — `_effetMatch`), situation, modif-joueur (mutDe), chance PDO (LUCK_GAME 0,10, LUCK_SEASON 0,035
- **L'adjoint joue cette série** — `_effetMatch`), situation, modif-joueur (mutDe), chance PDO (LUCK_GAME 0,10, LUCK_SEASON 0,035
- **Ton coach** — `_effetMatch`), situation, modif-joueur (mutDe), chance PDO (LUCK_GAME 0,10, LUCK_SEASON 0,035
- **Roulement** — `_effetMatch`), situation, modif-joueur (mutDe), chance PDO (LUCK_GAME 0,10, LUCK_SEASON 0,035
- **Effets temporaires des dilemmes et…** — `_effetMatch`), situation, modif-joueur (mutDe), chance PDO (LUCK_GAME 0,10, LUCK_SEASON 0,035
- **Trois défaites de suite** — `_effetMatch`), situation, modif-joueur (mutDe), chance PDO (LUCK_GAME 0,10, LUCK_SEASON 0,035
- **Les événements** — `_effetMatch`), situation, modif-joueur (mutDe), chance PDO (LUCK_GAME 0,10, LUCK_SEASON 0,035
- **Consigne du match** — `_effetMatch`), situation, modif-joueur (mutDe), chance PDO (LUCK_GAME 0,10, LUCK_SEASON 0,035
- **Rapport d'entracte** — `_effetMatch`), situation, modif-joueur (mutDe), chance PDO (LUCK_GAME 0,10, LUCK_SEASON 0,035
- **Avant le match » : la main** — `_effetMatch`), situation, modif-joueur (mutDe), chance PDO (LUCK_GAME 0,10, LUCK_SEASON 0,035
*Fichiers :* js/sim.js:1249-1270, js/sim.js:2426-2430, js/sim.js:4137-4172, js/sim.js:6692-6710

#### Qui joue contre qui · `nouveau:appariement`
*Tu vois, tu fais :* rien, sauf « à domicile : son appariement tient mieux » sur l'affiche et la note du 🔒.
*Ça change :*
- **Action spéciale du système** — quelle unité défend chaque lancer (cote d, étouffement des badges, action-speciale, +/-
*Ça dépend de :*
- **🔒 Trio de fermeture** — trio-fermeture
- domicile
- rang des unités
*Fichiers :* js/sim.js:4232-4296, js/sim.js:4407-4435, js/sim.js:4612-4630

#### Prolongation · `nouveau:prolongation`
*Tu vois, tu fais :* « BUT GAGNANT » en prolongation.
*Ça change :*
- **Le dé du pari** — qui gagne (logistique sur l'écart de clutch, /9
*Ça dépend de :*
- **Icônes 🛡️ Selke** — cote `c` cachée + trait 🧭 Meneur (+2, max 9
- pas des lancers
*Fichiers :* js/sim.js:5248-5255

#### Regarder le match · `direct`
*Tu vois, tu fais :* bandeau (pointage, horloge à rebours, tirs, « AN X · 85 s »), fil des jeux marquants (ou tous les tirs), vitesses ×½ à ×8, Pause (stats du match), Fin du match ; arrêt au 2e entracte d'un gros match.
*Ça change :*
- rien (rejoue la feuille)
*Ça dépend de :*
- **Les mises en échec coûtent des jambes** — la feuille : buts, lancers (`p`, `special`, `tac`, `mode`), punitions, blessures, physique, coups attendus, cartes jouées et plan adverse
*Fichiers :* js/direct.js:109-160, js/direct.js:182-189, js/direct.js:383-579

#### Le commentateur · `nouveau:commentaire`
*Tu vois, tu fais :* des phrases au fil (style du tireur, système de sa ligne, AN/DN, buts de la saison, « Le système de X fonctionne à merveille » sur une action spéciale).
*Ça change :*
- rien
*Ça dépend de :*
- **Action spéciale du système** — `tac`), avantage-numerique, bagarre/coups/melee (PHRASE_*
- **Système du trio** — `tac`), avantage-numerique, bagarre/coups/melee (PHRASE_*
*Fichiers :* js/commentaire.js:200-235, js/commentaire.js:371-494

#### Sommaire du match · `sommaire`
*Tu vois, tu fais :* buts, punitions, blessures, coups/bagarres/mêlées par période ; cartons « Les trois étoiles », « Le tableau » ; « Ce qui a décidé » (buts vs attendus, tirs, AN, gardien, actions spéciales, but gagnant) ; conseil du bilan (le trio qui convertit le moins à FE). le pointage et ses buts (« 12e but »), le rang ▲▼, « 🚑 blessé : n matchs », « 🔁 » (4 au plus), « Gros match gagné : 🔥 L'élan pour 3 matchs », « 📥 n messages à traiter » et le bouton vers la boîte.
*Ça change :*
- rien
- les choix forcés attendent qu'il se ferme (retenir)
*Ça dépend de :*
- la feuille
- **Action spéciale du système** — action-speciale
- **Avantage numérique** — avantage-numerique
- **Journée suivante** — journee
*Fichiers :* js/bilan.js:1279-1351, js/recit.js:192-254, js/entracte.js:322-350 ; js/saison.js:1648-1704

#### Rapport d'entracte · `entracte`
*Tu vois, tu fais :* des cartons qui se balaient ; au 2e entracte d'un gros match : 2 gestes selon le pointage (mené/égal/devant) + un incident + « Garder le cap ». le direct ou « Journée suivante » s'arrête à 40:00 : pointage, buts, tableau « Ce soir / Par match » (buts, tirs, précision, buts contre, punitions, mises en échec), l'incident du soir, leur plan contré ou non. 4 options : 2 tirées de la réserve du pointage, 1 venue de l'incident, « Garder le cap ».
*Ça change :*
- **Les canaux du moteur** — moteur-canaux de la 3e période seulement (ex. « Tout pour l'attaque » volume 1,18 / défense 1,15 ; « Deux trios, pas plus » F [1,35 1,25 0,7 0,5], usure 1,12
- **Cases « Partant** — « Envoyer l'auxiliaire »
- **Jambes** — énergie de la soirée entière
- **Le dé du pari** — les effets de la 3e période seulement (volume, finition, defense, discipline, robustesse, F/D, energie qui pèse sur les matchs suivants
- **Punitions** — les effets de la 3e période seulement (volume, finition, defense, discipline, robustesse, F/D, energie qui pèse sur les matchs suivants
- **Robustesse** — les effets de la 3e période seulement (volume, finition, defense, discipline, robustesse, F/D, energie qui pèse sur les matchs suivants
- « Envoyer l'auxiliaire » (changeGardien)
- la 3e période se rejoue sur des dés neufs
*Ça dépend de :*
- pointage après 40 min
- **Combat** — gros-match
- ENTRACTES par état (devant / égal / derrière), INCIDENTS
- **Avant le match » : la main** — deck-match apres40 (« L'instinct du tueur »
- **L'adjoint joue cette série** — adjoint en séries (choisit « garder »
*Fichiers :* js/sim.js:7412-7488, js/sim.js:5183-5245, js/entracte.js:154, js/entracte.js:322 ; js/sim.js:7399-7488 ; js/saison.js:3313-3368, 3644-3689

#### Sa confiance joue ×1,6 · `nouveau:porte-par-ses-joueurs`
*Tu vois, tu fais :* dans « Tes coachs », « N joueurs de sa couleur habillés : sa confiance joue ×… ». Tu signes ou habilles des joueurs de cette couleur.
*Ça change :*
- **Confiance I** — l'écart de chaque canal à 1 est multiplié par 1 + 0.15 × n, n ≤ 5, donc ×1,75 au plus ; la boutique et les minutes ne bougent pas
*Ça dépend de :*
- **🐝 Le Frelon** — des joueurs
- **Les 23 cases** — seuls les habillés non blessés comptent, pas les réservistes
- **Blessures** — blessure
*Fichiers :* js/coachs.js:81-92 ; js/sim.js:1227-1242

#### L'échelle du soir des cartes · `nouveau:courbe-rogue`
*Tu vois, tu fais :* en Rogue seulement, une carte qui grandit montre sa courbe ; le vestiaire dit « les cartes de trio aident tout de suite, puis plafonnent ; les améliorations… grandissent jusqu'en finale ».
*Ça change :*
- **🧬 Modif de joueur** — améliorations : l'écart × 0,5 au 1er match, × 1,5 au dernier, × 1,6/1,75/1,9/2 aux rondes
- **Avant le match » : la main** — le `adv` des cartes de match
*Ça dépend de :*
- **Le mode Rogue** — la ligue est créée avec courbe: true
- **Journée suivante** — journee
- **Séries éliminatoires** — series
*Fichiers :* js/sim.js:6335-6391 ; js/game.js:254-260 ; js/rogue-jeu.js:1434

### Gros match (9)

#### Combat · `gros-match`
*Tu vois, tu fais :* un bandeau aux couleurs adverses sur l'affiche ; dans le dépistage, leurs pistes, leur main, « Victoire : 🔥 L'élan, précision ↑ · 3 matchs / Défaite : 😵 Sonnés… » et « 🎬 Au deuxième entracte, un choix t'attend ». Après le match : « Gros match gagné/perdu ». La route et le calendrier le marquent ⚔️.
*Ça change :*
- **L'élan** — ELAN ×1,03 ou SONNE ×0,97 pendant 3 matchs, ×2 de durée avec un avant-match à enjeu
- **Le dé du pari** — ELAN ×1,03 ou SONNE ×0,97 pendant 3 matchs, ×2 de durée avec un avant-match à enjeu
- **Récompense** — recompense-deck si victoire
- **Les malédictions** — le doute) si défaite contre la rivalité
- **Avant le match » : la main** — deck-match / elan / entracte / depistage entrent en jeu
- **L'élan** — deck-match / elan / entracte / depistage entrent en jeu
- **Rapport d'entracte** — deck-match / elan / entracte / depistage entrent en jeu
- **🔎 Le dépistage : leur plan probable » et la…** — deck-match / elan / entracte / depistage entrent en jeu
- **🪙 N jetons** — jetons +20 en Rogue
*Ça dépend de :*
- annoncé la veille (ANNONCE_GROS = 1 jour)
- pas avant ton 10e match
- ESPACEMENT_GROS = 4 matchs
- rival à 2 rangs ou moins (classement PTS puis V), ou rivalité (2 défaites contre ce club, éteinte en le battant)
*Fichiers :* js/sim.js:7797-7851, 5966-5982, 6050-6079 ; js/saison.js:1009-1022, 2677-2695, 2002-2003, 1691-1693

#### L'événement d'avant le combat · `nouveau:avant-match`
*Tu vois, tu fais :* un plein écran « Événement » à l'annonce (« Avant le combat · demain contre X »), avec le dépistage en contexte. La garantie, la guerre des mots, le virus (3 joueurs nommés), le samedi soir, la chanson, la pieuvre, le rat (pari), les poteaux (gardien), l'ancien, le gabarit, le filet désert, l'arbitre.
*Ça change :*
- effets du soir du match (effetAvant)
- nouveau:absents (rappel)
- **Jambes** — −35 / −20
- **Cases « Partant** — auxiliaire
- **Le dé du pari** — pari
- **Le dé du pari** — la durée de l'élan ou de Sonnés ×2
*Ça dépend de :*
- **Combat** — gros-match
- jamais deux fois le même (avantDuGros)
- ciblesDe
*Fichiers :* js/sim.js:7295-7397 ; js/saison.js:1015-1022, 2956-2970

#### 🔎 Le dépistage : leur plan probable » et la… · `depistage`
*Tu vois, tu fais :* trois pistes (plan, réglage, %), touchées pour « Me préparer » (2 avec Le plan B). Puces : « 🎯 Vise juste : leur plan tombe · précision +5 %, buts contre −5 % », « 💥 Rate : −4 % / +4 % », « Sans préparation : rien ne change ».
*Ça change :*
- PREP_JUSTE : leur plan tombe et finition ×1,05, defense ×0,95
- PREP_RATEE : ×0,96 / ×1,04
- **Rapport d'entracte** — « contré » s'affiche dans l'histoire et à l'entracte
*Ça dépend de :*
- **Le dé du pari** — le système de leurs lignes, l'agressivité, en séries le plan d'hier : ×3 s'il a gagné, ×0,15 s'il a perdu
- leur vrai plan est TIRÉ du rapport
- **Avant le match » : la main** — ecarte, revele, planB, improvise, piege
*Fichiers :* js/sim.js:7236-7287, 7559-7578 ; js/gerant.js:1175-1204

#### Avant le match » : la main · `deck-match`
*Tu vois, tu fais :* un plein écran « Combat » : le dépistage à choisir, leur main, la rangée des cartes (coût, « trop cher », « injouable »), « Ce soir, sur la glace » (les effets combinés), les stats des deux clubs, « Jouer ces cartes / Ne rien jouer », « Recommencer la main », « Mon deck · n ». Pas de « Plus tard ».
*Ça change :*
- **Le dé du pari** — effets de CE match (finition, volume, defense, discipline, energie, robustesse, F/D), effets sur l'adversaire, son plan qui tombe, sa main annulée, jambes rendues, cartes épuisées retirées pour la course
- **Punitions** — effets de CE match (finition, volume, defense, discipline, energie, robustesse, F/D), effets sur l'adversaire, son plan qui tombe, sa main annulée, jambes rendues, cartes épuisées retirées pour la course
- **Robustesse** — effets de CE match (finition, volume, defense, discipline, energie, robustesse, F/D), effets sur l'adversaire, son plan qui tombe, sa main annulée, jambes rendues, cartes épuisées retirées pour la course
- **Jambes** — effets de CE match (finition, volume, defense, discipline, energie, robustesse, F/D), effets sur l'adversaire, son plan qui tombe, sa main annulée, jambes rendues, cartes épuisées retirées pour la course
- **Confiance I** — confiance des coachs (couleur des cartes jouées
*Ça dépend de :*
- **Le dé du pari** — départ de 10 cartes + récompenses − ménage + camp + malédictions + cicatrices − épuisées
- mainDuMatch(graine, j/po)
- **L'élan** — elan
- **Puces d'unité « 🧩 Ligne d'origine** — cartes d'origine
- **🎯 Sniper Or** — badge et rôles (synergies
*Fichiers :* js/combat.js:73-305, 362-424 ; js/gerant.js:1329-1459 ; js/saison.js:1032-1065 ; js/sim.js:7545-7666

#### L'élan · `elan`
*Tu vois, tu fais :* des orbes « Élan 3 », « 1 élan » sur chaque carte, « +1 élan ».
*Ça change :*
- **Le dé du pari** — combien de cartes on joue (energieDepensee : coût, rabais, energiePlus
*Ça dépend de :*
- ENERGIE_MAIN = 3
- l'adversaire a 4 dès le jour 125 (« 55e match ») et dès la 3e ronde (energieAdverse)
*Fichiers :* js/combat.js:37, 482-516

#### 🂠 La main de X ce soir · `nouveau:main-adverse`
*Tu vois, tu fais :* leurs cartes en puces vues de ton côté (« Eux : … », « Toi : … »), « ⚡ 4 d'élan » en fin de saison.
*Ça change :*
- **Le dé du pari** — effets adverses joués au match, sauf si « Leur cahier de jeux » les annule
- « La riposte » et « La contre-attaque » se règlent sur leur main
*Ça dépend de :*
- POOL_ADVERSE (ni carte d'origine, ni horsAdverse, ni légendaire)
- echelleTardive en Rogue
*Fichiers :* js/combat.js:445-495 ; js/gerant.js:1263-1287 ; js/sim.js:7517-7534

#### Les malédictions · `malediction`
*Tu vois, tu fais :* des cartes « maudite » dans le deck ; « Dans ta main : précision −3 % » ; « Injouable ». Le portail du bureau compte « n malédictions ».
*Ça change :*
- **Avant le match » : la main** — elles encombrent la main
- **Blessures** — le doute coûte finition ×0,97 en main, la blessure qui traîne energie ×1,05, la distraction 1 élan pour rien
*Ça dépend de :*
- **Le proprio fixe ses attentes** — objectif-proprio raté (distraction
- **Cicatrices** — cicatrice
- **Le ménage du vestiaire** — palier-menage pour les retirer
*Fichiers :* js/combat.js:298-305, 385-406

#### Cicatrices · `cicatrice`
*Tu vois, tu fais :* rien au moment où elles naissent ; on les voit dans le deck.
*Ça change :*
- **Les malédictions** — le doute après un gros match perdu contre la rivalité, la blessure qui traîne après une blessure de 15 matchs et plus
- CICATRICES_MAX = 2 (la plus ancienne tombe)
- chaque série gagnée en efface une
*Ça dépend de :*
- **Combat** — raison nemesis), blessure (games ≥ 15), series
*Fichiers :* js/combat.js:39-40, 389-405 ; js/saison.js:1032-1036

#### Récompense · `recompense-deck`
*Tu vois, tu fais :* un paquet qui s'ouvre (walkout), 3 cartes, « Passer ».
*Ça change :*
- **Avant le match » : la main** — +1 carte (gros match : commune 60, peu 30, rare 10 ; série : peu 50, rare 42, légendaire 8
- **Cicatrices** — sans dés neufs. En séries, la décision efface aussi une cicatrice
*Ça dépend de :*
- une victoire en gros match
- une série gagnée (pas la finale)
- recompensesOffertes
*Fichiers :* js/combat.js:426-443 ; js/saison.js:1045-1049, 2971-2978, 3702-3720

### Séries (7)

#### Séries éliminatoires · `series`
*Tu vois, tu fais :* le combat de boss (« vies » 4−victoires, rapport d'éclaireur : leurs lignes et leur contre, vedette, gardien), « Préparer le match k », « Le banc », « 🃏 Tes cartes · match k » (obligatoire avant « Match suivant » ou « Regarder »), « Finir la ronde » une fois ta série décidée, « Passer à la fin » une fois éliminé, « 🃏 Mon deck ».
*Ça change :*
- **Le dé du pari** — chaque match de ta série est mis en scène (plan, dépistage, main, entracte
- **Rapport d'entracte** — chaque match de ta série est mis en scène (plan, dépistage, main, entracte
- le plan adverse se garde s'il a gagné et change s'il a perdu
- stats séparées (p.po)
*Ça dépend de :*
- **Le dé du pari** — 16, ou la puissance de 2 qui tient
- appariement 1 contre n
- chaque série a sa graine (S90 : s.i)
- **Cartes d'effet de saison** — carte-saison et coachs y jouent, les effets temporaires (jourCourant = ∞) non
- **L'élan** — elan adverse 4 dès la ronde 3
*Fichiers :* js/saison.js:3453-4106 ; js/sim.js:6907-7086 ; js/bilan.js:923-1042

#### Ton ajustement pour ce match · `nouveau:ajustement-serie`
*Tu vois, tu fais :* dès le 2e match, une rangée de 3 ajustements en tête de la main (leur vedette, le rythme, rien à perdre, le gardien en mission, vidéo et repos, rentrer dedans, discipline, le capitaine parle, l'auxiliaire, un coup de dés, l'avantage). « Choisis ton ajustement » bloque « Jouer ».
*Ça change :*
- **Le dé du pari** — effetsSerie de ce match (canaux
- **Cases « Partant** — auxiliaire
- pari 50 %
*Ça dépend de :*
- **Le dé du pari** — graine, ronde, k, état de la série
*Fichiers :* js/sim.js:7088-7117, 7063-7086 ; js/gerant.js:1381-1385

#### L'adjoint joue cette série · `adjoint`
*Tu vois, tu fais :* un bouton dans la main ; ensuite, « L'adjoint joue cette série ». des cartes 👔 avec leur rôle (Entraîneur-chef, Adjoint à l'attaque…, Dépistage, Direction). « Engager » ; s'il y a déjà 3 postes, l'écran « … : qui part ? ». « Toute la saison, séries comprises. »
*Ça change :*
- **Avant le match » : la main** — il joue les cartes au plus gros gain (ni pari, ni pioche, ni carte épuisée
- **Ton ajustement pour ce match** — ajustement-serie sans pari
- la piste la plus probable
- **Rapport d'entracte** — « garder » à chaque entracte, pour toute la ronde
- **Les canaux du moteur** — effet, lu comme une carte de saison
- **La boutique** — econ : rabais 0.85–0.95, holo ×1.15–1.25, carteExtra +1, sansBase
- **🪙 N jetons** — jetonsVictoire +1 à +3
- **Plafond restant …** — plafond +2,5 % ou +5 %
- **Confiance I** — l'engagement compte comme une carte jouée de sa couleur
*Ça dépend de :*
- mainDeLAdjoint
- MAX_PATRONS = 3, un par rôle (le dernier remplace)
- **Le dé du pari** — si le rôle `avec` est engagé : un effet de plus
- **Ton coach** — +par carte du coach déjà jouée, au plus 10, fixé à l'engagement
- en Rogue, le personnel est permanent (méta) et un patron déjà possédé est revendu
- **Ce qui te suit aussi… Ce qui expire…** — report-de-saison
*Fichiers :* js/combat.js:518-539 ; js/saison.js:3642-3653, 3767-3774 ; js/banque.js:50-168, 665-688, 715-728 ; js/rogue-jeu.js:484-496 ; js/inventaire.js:141-150

#### Run N · `nouveau:sort-de-la-run`
*Tu vois, tu fais :* au bilan, un bloc qui remplace « Rejouer » et « Nouvelle partie ». La run finie ouvre l'écran « Ta run » (saisons, sort, 🏅 gagnés, jalons, cartes entrées) ; la Coupe ouvre son écran avec la sirène, tes 3 vedettes et la vitrine.
*Ça change :*
- **Rejouer la saison** — les boutons sont cachés en Rogue
- **Ceux qui restent** — gardes-de-saison
- **Le mode Rogue** — une nouvelle
- **🏆 Ta vitrine** — meta.vitrine, meta.derniereRun, carton du menu
*Ça dépend de :*
- **Le proprio veut : faire les séries** — mandat
- **Séries éliminatoires** — series
- **🏅 écussons** — comptés par la run
- **🏁 Les jalons** — jalons
*Fichiers :* js/rogue-jeu.js:1021-1131 ; js/game.js:1245-1251

#### 🏅 écussons · `ecussons`
*Tu vois, tu fais :* des toasts « 🏅 +N écussons pour ta saison (P points) » et « …pour tes séries ». Le compte est sur la barre, au vestiaire et au menu.
*Ça change :*
- **Le vestiaire des déblocages** — achat
- **📈 Club de garage … Dynastie** — seuls ceux gagnés à vie comptent, jamais ceux dépensés
*Ça dépend de :*
- **Le dé du pari** — 1 par tranche de 2
- **Séries éliminatoires** — 10 par ronde, +20 pour la Coupe
- **🧪 +N écussons de découverte** — +1 par carte
- **🏁 Les jalons** — jalons. Versés une fois par saison et par étape
*Fichiers :* js/rogue.js:170-172, 339-360 ; js/rogue-jeu.js:960-999

#### 🏁 Les jalons · `jalons`
*Tu vois, tu fais :* au vestiaire, « texte → récompense » ou « ✓ Atteint » ; un toast « 🏁 Jalon : … ».
*Ça change :*
- **Le vestiaire des déblocages** — offert s'il n'est pas déjà pris et si son prérequis l'est : series → classeur1, ronde → banc1, cent → classeurTri, troisSaisons → garder1, finale → plafond1, coupe → classeurChoix
- **🏅 écussons** — sinon ecussons (20 à 120
- **📈 Club de garage … Dynastie** — series, ronde et finale sont exigés pour les rangs 2, 3 et 4
*Ça dépend de :*
- **Séries éliminatoires** — 100), serieMax (10), saisonDeLaRun (2, 3), premier, finale, coupe, cartable (100 cartes), cartes jouées en Rogue (50), niveau (5 niveaux dans l'équipe
*Fichiers :* js/rogue.js:410-452 ; js/rogue-jeu.js:940-957

#### Sur table · `sur-table`
*Tu vois, tu fais :* pas de boutique, de jetons, de deck ni de confiance ; le plateau ne lit pas les bonus de variante.
*Fichiers :* js/banc.js:595 ; js/table.js (aucune lecture de _carte)

### Entre les saisons (8)

#### Le bilan de saison · `bilan`
*Tu vois, tu fais :* la fiche qui se compte, le rang, PTS, BP, BC, Diff, Masse. Les chapitres Résumé (le conseil et les cartons), Chiffres (domicile, route, matchs d'un but, après 2 périodes…), Rythme (la courbe .500, les tranches de 10, les séquences), Forces (7 vraies stats en rang), Cartes (tes cartes de saison et ton deck, « les plus jouées »), Vestiaire (situations et infirmerie). Boutons « Jouer les séries », « Copier le résultat », « Rejouer la saison », « Nouvelle partie ».
*Ça change :*
- **Collection › Saisons** — saveLeaderboard
- **Ton album** — le deck de fin de saison
*Ça dépend de :*
- les feuilles (saisonDesFeuilles), you.cartes, deckDe, you.situations, conseilDuBilan (le trio qui convertit le moins, ou le rang en BC ou en BP)
*Fichiers :* js/bilan.js:300-917, 502-629 ; js/recit.js:192-206 ; js/entracte.js:154-280

#### Les trophées de la saison · `trophees`
*Tu vois, tu fais :* Art-Ross, Maurice-Richard, Meilleur passeur, Meilleur gardien (%ARR, au moins 25/82 départs), Meilleur différentiel ; une équipe d'étoiles par case jouée ; « n de tes joueurs y sont ».
*Ça change :*
- rien
*Ça dépend de :*
- **Le dé du pari** — les compteurs de saison (statsSim
*Fichiers :* js/bilan.js:131-209

#### Rejouer la saison · `rejouer`
*Tu vois, tu fais :* le bouton du bilan, titré « Le même alignement, les mêmes 31 clubs, d'autres dés ».
*Ça change :*
- une saison neuve avec les mêmes adversaires, une nouvelle graine, décisions et séries remises à zéro
*Ça dépend de :*
- G.ligue.adversaires
- **Le dé du pari** — G.roster de fin de saison
*Fichiers :* js/game.js:2393-2411 ; js/bilan.js:851, 910

#### Ceux qui restent · `nouveau:gardes-de-saison`
*Tu vois, tu fais :* l'écran du classeur ouvert sur ton équipe finie : « Garde jusqu'à 5 joueurs », barre « 🤝 Budget des gardés ».
*Ça change :*
- **Le départ du classeur** — le budget suivant = budget du classeur − masse des gardés
- **Le repêchage** — repechage-rogue
- **🧬 Modif de joueur** — chaque carte rejoue ses mods
*Ça dépend de :*
- GARDES_DE_SAISON = 5
- budgetDuClasseur
*Fichiers :* js/rogue.js:370 ; js/rogue-jeu.js:1184-1199

#### Le repêchage · `repechage-rogue`
*Tu vois, tu fais :* « Saison N de la run · K postes à combler », des Réguliers tirés de 8 saisons au hasard (35–70 % de production), « 💰 Budget restant », « Passer le repêchage ».
*Ça change :*
- **Les 23 cases** — autoRoster de gardés + classeur + repêchés
- **Le montant sur la carte** — salaire
*Ça dépend de :*
- **Garder un joueur** — gardes de saison et classeur (les postes qui restent sur 14 F / 7 D / 2 G
- **Le dé du pari** — budget 82 M$ + vestiaire − 12 M$ − masse (sans les 45 M$ réservés ni le bonus de prestige
- **📈 Club de garage … Dynastie** — budget 82 M$ + vestiaire − 12 M$ − masse (sans les 45 M$ réservés ni le bonus de prestige
*Fichiers :* js/rogue-jeu.js:1247-1310

#### Ce qui te suit aussi… Ce qui expire… · `nouveau:report-de-saison`
*Tu vois, tu fais :* un paragraphe au bilan, puis un toast « Saison N de la run : …, et 🪙 X jetons. Le proprio veut : … ».
*Ça change :*
- **Avant le match » : la main** — deckDeBase sans les malédictions ni les cicatrices
- **Confiance I** — coachsDeBase et les paliers allumés
- **L'adjoint joue cette série** — les patrons engagés restent en poste
- **Garder scellé** — ceux qui ne sont pas ouverts passent, déjà payés
- **🪙 N jetons** — départ = caisse + reste
- **🧬 Modif de joueur** — rejouées au jour 0
- **Plafond restant …** — refait comme au départ
- **Ton inventaire** — la poche « Cette saison » expire
*Ça dépend de :*
- **Le proprio veut : faire les séries** — continue
*Fichiers :* js/rogue-jeu.js:1311-1363 ; js/combat.js:371-373

#### 🧪 +N écussons de découverte · `nouveau:prime-decouverte`
*Tu vois, tu fais :* un toast après la saison.
*Ça change :*
- **🏅 écussons** — +1 par carte qui finit sa première saison avec toi, une fois pour toujours
*Ça dépend de :*
- **(ce que le repêchage y envoie)** — le drapeau d
- **Les 23 cases** — l'équipe finale
*Fichiers :* js/rogue.js:359 ; js/cartable.js:102-108 ; js/rogue-jeu.js:972-977

#### 🧱 Le Mur · `nouveau:moments-legendaires`
*Tu vois, tu fais :* des toasts à la fin de la saison.
*Ça change :*
- **(ce que le repêchage y envoie)** — gravés dans x.legendes
*Ça dépend de :*
- **Le dé du pari** — les feuilles de match (42 arrêts ou plus et une victoire, jeu blanc, 3 buts ou plus, 4 points ou plus dans une victoire
*Fichiers :* js/rogue-jeu.js:880-933 ; js/cartable.js:134-150

### À vie (7)

#### Statistiques : Réelles · `nouveau:options-affichage`
*Tu vois, tu fais :* les stats proratées à 82 matchs et à l'époque ; les salaires en dollars d'époque.
*Ça change :*
- **Le gros chiffre de la carte : « 82 PTS** — chiffre-cle, tris, carte, fiche
- **Plafond restant » 95,5 M$** — jauge du plafond (montant en dollars d'époque
*Fichiers :* js/game.js:943-970 ; js/repechage.js:829-841

#### Collection › Saisons · `historique`
*Tu vois, tu fais :* la fiche, les pts, le différentiel, « meilleure » (à format égal), le verdict des séries (🏆 Coupe / Éliminé — ronde), le rang, l'époque, la masse, la date ; « Rejouer ».
*Ça change :*
- **Rejouer la saison** — reprendreAlignement : les 23 joueurs relus, de NOUVEAUX clubs, de nouveaux dés
*Ça dépend de :*
- **Le bilan de saison** — majLeaderboard
- **Séries éliminatoires** — majLeaderboard
*Fichiers :* js/game.js:2196-2252, 2413-2449

#### 🏆 Ta vitrine · `nouveau:vitrine`
*Tu vois, tu fais :* au vestiaire, chaque Coupe (run, saison, coach, 3 vedettes).
*Ça change :*
- rien en jeu
*Ça dépend de :*
- **Run N** — gagnee
*Fichiers :* js/rogue-jeu.js:1081-1084, 1424-1425

#### Le vestiaire des déblocages · `deblocages`
*Tu vois, tu fais :* une liste « Nom · prix 🏅 » avec « Demande d'abord : … » ou « Il te manque N 🏅 ». Tu touches pour acheter.
*Ça change :*
- **Garder un joueur** — garder1–3 : 40/120/240
- **🪙 N jetons** — caisse1/2 : 30/100 ; commanditaire1/2 : 60/150
- **Pack Bronze/Argent/Or/Premium** — packDefenseurs 35, packGardiens 50, packAnnees80 60, packVedettes 150 déverrouillent les packs
- **Avant le match » : la main** — deckPlus 50 : Lancer de la pointe+ et Bloquer des tirs+, saison 1
- **Tes plombiers** — plombiersPlus 80
- **Plafond restant …** — plafond1/2 : 45/110
- **L'adjoint joue cette série** — dgFlexible 70 met dir_flexible dans le personnel
- **Le départ du classeur** — classeur1–3 : 50/130/240, classeurTri 90, classeurChoix 280
- **🪑 N réservistes** — banc1/2 : 60/150
*Ça dépend de :*
- **🏅 écussons** — ecussons
- **🏁 Les jalons** — qui en offrent
*Fichiers :* js/rogue.js:78-116, 278-293 ; js/rogue-jeu.js:1412-1450

#### Ton album · `album`
*Tu vois, tu fais :* les cartes de match eues (×N, celles qui manquent en silhouette), tes identités, les joueurs qui ont porté tes couleurs (les champions en premier).
*Ça change :*
- rien
*Ça dépend de :*
- **Collection › Saisons** — le deck final, l'alignement, la Coupe
*Fichiers :* js/album.js:22-86 ; js/game.js:2194-2200

#### Onglet « Le classeur · `nouveau:classeur-banque`
*Tu vois, tu fais :* toute la banque par famille et rareté ; celles que tu n'as pas sont grisées (« Pas encore dans ta collection »).
*Ça change :*
- rien
*Ça dépend de :*
- **Le dé du pari** — meta.cartes (les cartes tirées de packs seulement
*Fichiers :* js/inventaire.js:182-188 ; js/rogue.js:325-332

#### Jouer un match d'exhibition · `exhibition`
*Tu vois, tu fais :* rien n'est écrit : ni cartable, ni jetons, ni méta.
*Fichiers :* index.html:419-427 ; js/game.js:1242

### Boutique (16)

#### 🐝 Le Frelon · `couleur`
*Tu vois, tu fais :* chaque carte de la banque porte le nom d'un coach ou « Neutre ». Dans un pack de joueurs, une ligne « 🐝 Joueur du Frelon ». Rien à décider : ça se lit.
*Ça change :*
- **Confiance I** — une carte de couleur compte pour son coach
- **Tirs +0,4 % par carte 🐝 du Frelon jouée** — echelle et parJoueur lisent la couleur
- **Sa confiance joue ×1,6** — porte-par-ses-joueurs
*Ça dépend de :*
- **Robustesse** — la carte, lue par coachDesCanaux sur ses canaux (AMPLEUR finition 3, volume 4, defense 3, robustesse 0.6, discipline 10, blessure 20, energie 8, minutes 15
- **Punitions** — la carte, lue par coachDesCanaux sur ses canaux (AMPLEUR finition 3, volume 4, defense 3, robustesse 0.6, discipline 10, blessure 20, energie 8, minutes 15
- **Blessures** — la carte, lue par coachDesCanaux sur ses canaux (AMPLEUR finition 3, volume 4, defense 3, robustesse 0.6, discipline 10, blessure 20, energie 8, minutes 15
- **Ton coach** — elle est neutre si le signal est < 0.7 ou si le deuxième coach fait ≥ 80 % du premier. Les contrats vont toujours au Comptable. Le joueur, lui, prend la couleur de son meilleur rôle maîtrisé (≥ 55) par COACH_DU_ROLE
- **Le dé du pari** — elle est neutre si le signal est < 0.7 ou si le deuxième coach fait ≥ 80 % du premier. Les contrats vont toujours au Comptable. Le joueur, lui, prend la couleur de son meilleur rôle maîtrisé (≥ 55) par COACH_DU_ROLE
*Fichiers :* js/coachs.js:64-74, 148-202 ; js/banque.js:430-450 ; js/sim.js:1226

#### Son dépisteur recrute des patineurs qui… · `nouveau:depisteur-du-coach`
*Tu vois, tu fais :* une phrase au choix du coach et dans la fiche d'un pack (« Le dépisteur du Frelon recrute… »). Rien à décider.
*Ça change :*
- **Pack Bronze/Argent/Or/Premium** — à niveau égal, on tire deux candidats et on garde celui qui a le meilleur score d'identité du coach
*Ça dépend de :*
- **Ton coach** — coach
- **Puces d'unité « 🧩 Ligne d'origine** — IDENTITES.*.score). Ne touche ni les packs talent ni le Trio
*Fichiers :* js/packs.js:316-337, 409 ; js/rogue-jeu.js:233-239

#### Ton club · `club-cosmetique`
*Tu vois, tu fais :* un rayon « 🏅 Ton club » à la boutique, en trois onglets : 8 noms (15–35 🪙), 50 couleurs (15–60), 30 écussons (15–50). Le « Ton club » du vestiaire sert à porter ce que tu as.
*Ça change :*
- rien en jeu
- **Le dé du pari** — l'en-tête, TEAM_COLORS.YOU et nomDuClub (le nom de ton équipe dans la ligue
*Ça dépend de :*
- **🪙 N jetons** — une décision d'achat sorte 'club', comptée par jetonsRogue
- **📈 Club de garage … Dynastie** — rangs 1 à 4
*Fichiers :* js/club.js:24-262 ; js/rogue-jeu.js:188-196, 1382-1410 ; js/magasin.js:98-109, 195-212

#### 🃏 Carte de match · `nouveau:carte-de-match-en-pack`
*Tu vois, tu fais :* dans la poche, le bouton « Au deck ».
*Ça change :*
- **Avant le match » : la main** — payload {recompense}
- **Confiance I** — compte pour son coach
*Ça dépend de :*
- **Pack Personnel** — Pack Cartes de match, Mixte, Lot, Pack du coach
- horsAdverse (l'adversaire ne pige pas les cartes v2)
*Fichiers :* js/banque.js:462-465, 758 ; js/combat.js:278, 370-388

#### ⏳ Se garde · `nouveau:vie-de-carte`
*Tu vois, tu fais :* deux étiquettes au pied de chaque carte de la banque.
*Ça change :*
- **Ton inventaire** — dans quelle poche elle va, quand elle expire
*Ça dépend de :*
- **Le dé du pari** — la famille et la rareté de la carte (maudite ou saison = immédiat
*Fichiers :* js/banque.js:552-569 ; js/inventaire.js:94

#### Cadeau · `nouveau:etiquette-forme`
*Tu vois, tu fais :* un mot sur la carte avant les chiffres.
*Ça change :*
- **Le dé du pari** — de la lecture
*Ça dépend de :*
- **Le dé du pari** — le signe des canaux de la carte
*Fichiers :* js/banque.js:471-547

#### ✦ Or numérotée /99 /25 /10 1 de 1 · `nouveau:numerotation`
*Tu vois, tu fais :* un numéro sur l'or et sur son badge au cartable ; la fiche dit « Le numéro est un honneur, pas un bonus. »
*Ça change :*
- **Vendre** — ×1/2/4/10
- **Carton Base** — bonus retirés par numéro
*Ça dépend de :*
- **Pack Bronze/Argent/Or/Premium** — 78/16/5/1 % des or
*Fichiers :* js/packs.js:83, 270-274 ; js/rogue-jeu.js:241-242 ; js/magasin.js:171

#### La boutique · `boutique`
*Tu vois, tu fais :* des rayons (Le pack du jour, Au hasard, Équipe/année/trio, Les époques, Par talent, Les cartes, Ton club, 📦 Déjà à toi). Une tuile montre son tier, son nombre de cartes, la chance phare et son prix (« il te manque N 🪙 »). Sa fiche : toutes les chances, le joueur d'une carte, la finition, le choix (franchise, saison ou coach), « Acheter » ou « Garder scellé ». À la première run, avant le ~20e match, seulement 4 packs (« Voir les N packs »).
*Ça change :*
- **🪙 N jetons** — jetons
- **Pack Bronze/Argent/Or/Premium** — pack-joueurs
- **Pack Personnel** — pack-cartes
- **Garder scellé** — pack-scelle
- **Ton club** — club-cosmetique
*Ça dépend de :*
- **Le vestiaire des déblocages** — verrous
- **La date limite des échanges est passée** — date-limite
- **L'adjoint joue cette série** — rabais, « ton DG négocie −N % »
- **Confiance I** — rabais, « ton DG négocie −N % »
- **Plafond restant …** — ligne 💵
- **🛟 La garantie** — pitie
*Fichiers :* js/magasin.js:47-220 ; js/rogue-jeu.js:138-206 ; js/game.js:1896-1902

#### Pack Bronze/Argent/Or/Premium · `pack-joueurs`
*Tu vois, tu fais :* le paquet se déchire et les cartes se retournent, la meilleure en dernier. Chacune dit son niveau, sa ligne, ses bonus et sa couleur. Tu en signes une (puis « qui sort ») ou « Plus tard » : l'offre reste dans la boîte jusqu'à la fin de la journée.
*Ça change :*
- **Signer** — signature/qui-sort
- **X arrive : qui sort ? » puis « Où joue X ?** — signature/qui-sort
- **(ce que le repêchage y envoie)** — toutes
- **🪙 N jetons** — doublons revendus, la vente est annulée si on signe le doublon
- **🛟 La garantie** — pitie
*Ça dépend de :*
- tier (3/4/5/6 cartes ; niveaux bronze 51/37/11,15/0,8/0,05… premium 14/40/39/6/1)
- **📈 Club de garage … Dynastie** — prestige
- **Son dépisteur recrute des patineurs qui…** — depisteur-du-coach
- **L'adjoint joue cette série** — holo, carteExtra, sansBase
- **Plafond restant …** — salaireMax
- **Le dé du pari** — on ne tire jamais un joueur de la ligue ni un joueur déjà signé
- « Déjà dans ton équipe » est désactivé
- **La date limite des échanges est passée** — date-limite
*Fichiers :* js/packs.js:76-124, 338-419 ; js/rogue-jeu.js:217-348 ; js/saison.js:3015-3030

#### Pack Personnel · `pack-cartes`
*Tu vois, tu fais :* tout s'ouvre en même temps et va à l'inventaire (« Tout ranger ») ; « Pas de chance : … frappe tout de suite ».
*Ça change :*
- **Ton inventaire** — inventaire
- **L'adjoint joue cette série** — adjoint et consommables permanents (méta, en Rogue
- **💵 Masse salariale** — taxe
- **Onglet « Le classeur** — classeur-banque
*Ça dépend de :*
- famille tirée à parts égales, puis rareté aux cotes 55/30/12/3 (Personnel 45/35/16/4)
- **Ton coach** — Pack du coach : 4 cartes de la couleur choisie (ou au hasard
- **Le dé du pari** — Pack du coach : 4 cartes de la couleur choisie (ou au hasard
- **🐝 Le Frelon** — Pack du coach : 4 cartes de la couleur choisie (ou au hasard
- maudite 8 % (Contrats) ou 10 % (Lot)
*Fichiers :* js/packs.js:126-139, 429-459 ; js/rogue-jeu.js:365-396

#### 🛟 La garantie · `nouveau:pitie`
*Tu vois, tu fais :* « 8 packs de joueurs d'affilée sans holo ni or, et le suivant en a une. Tu en es à N sans. » Au tirage, « la garantie a joué ».
*Ça change :*
- **Pack Bronze/Argent/Or/Premium** — la dernière carte devient holo
*Ça dépend de :*
- **Le mode Rogue** — Rogue seulement
- packsSansHolo ≥ PITIE − 1
*Fichiers :* js/packs.js:84-85, 465-472 ; js/rogue-jeu.js:258 ; js/magasin.js:110-111

#### 📆 Le pack du jour −25 % aujourd'hui · `nouveau:pack-du-jour`
*Tu vois, tu fais :* un pack mis en vitrine, avec son prix barré.
*Ça change :*
- **🪙 N jetons** — prix × 0,75
*Ça dépend de :*
- **Le dé du pari** — la vraie date de l'appareil
- jamais un pack verrouillé, ni le Lot, ni Légendes
*Fichiers :* js/packs.js:155-165 ; js/magasin.js:51, 77

#### L'annonce saison · `walkout`
*Tu vois, tu fais :* avant la dernière carte, sa saison, son poste et son logo s'annoncent.
*Ça change :*
- rien
*Ça dépend de :*
- **Pastille Soutien** — la carte retournée en dernier (classée d'abord par finition, puis par niveau
- holo ou mieux, ou un Phénomène
*Fichiers :* js/gerant.js:287-294, 570-603 ; js/rogue-jeu.js:307-308

#### Vendre · `revente`
*Tu vois, tu fais :* un bouton dans la poche ; un prix sur un doublon à l'ouverture.
*Ça change :*
- **🪙 N jetons** — jetons
*Ça dépend de :*
- **🧴 Consommable » et sa cible** — VENTE commune 1, peu 1, rare 2, légendaire 5, consommable 0 (≤ 40 % du prix d'un pack
- un joueur doublon = VENTE × numéro
- un patron déjà possédé (Rogue)
*Fichiers :* js/inventaire.js:68-77 ; js/rogue-jeu.js:241-242, 375-379, 434

#### Doublon · `nouveau:doublon`
*Tu vois, tu fais :* la ligne « Doublon : revendu N 🪙 si tu ne le signes pas ».
*Ça change :*
- **Vendre** — revente
- **Signer** — signé, la vente est annulée
*Ça dépend de :*
- meta.collection (les joueurs déjà tirés d'un pack)
*Fichiers :* js/rogue-jeu.js:260-263, 310-326

#### Garder scellé · `nouveau:pack-scelle`
*Tu vois, tu fais :* on paie tout de suite et on ouvre plus tard ; le tirage se fait à l'ouverture.
*Ça change :*
- **🪙 N jetons** — jetons
- **Pack Bronze/Argent/Or/Premium** — ouvert = un achat à 0 🪙
- **Pack Personnel** — ouvert = un achat à 0 🪙
- **Ce qui te suit aussi… Ce qui expire…** — report-de-saison
*Ça dépend de :*
- **La date limite des échanges est passée** — date-limite
*Fichiers :* js/rogue-jeu.js:139-150, 177-204, 1343 ; js/magasin.js:84-92, 176
