# Les histoires de la V25 — quarante fiches (tranche C0)

La tranche **C0** du devis V25 (docs/refonte-v25.md § 4 C et la tranche 5 ; 6 nov. 2026 ; JP : *continue*). Quarante histoires, livrées en fiches **avant que C1 les code** : JP les lit et tranche les neuf questions du § 4. Écrites avec l'agent `rogue-recit`, relues par la session. C1 (6 nov. 2026, docs/refonte-v25-c1.md) a posé js/faits.js et js/histoires.js d'après ces fiches : la banque du jeu, c'est `HISTOIRES` ; ce document est la source des fiches et des neuf réponses de JP.

Chaque fiche dit : la voix (une clé d'`EXPEDITEURS`, js/vie-gm.js), le moment (le lundi, le jour du gros match, la ronde de séries), la famille, le fait (la condition `quand(f)` en une ligne, le champ de faits lu, le joueur nommé), la réplique (elle nomme), la ligne de chiffres sous elle, les options (chacune une carte de jeu : sa clé, son nom, son niveau, son effet dans la grammaire de js/effets.js, ce qu'on voit), où l'issue se lit, et le juge qui la tient. Les poids « ≈ x V » sont des estimations à peser avec `check_effets DETAIL=1` en C1 ; une option ne doit jamais dominer l'autre de plus de 0,3 V. **C1 (6 nov. 2026) a pesé** : les bornes et le style tiennent pour les quarante ; dix-sept effets trop faibles pour se voir dans la feuille ont monté au plancher (les tirs du joueur nommé à ×1,5, sa précision perdue à ×0,6 ou ×0,7, le duo à ×1,4 et ×1,3, les canaux d'un soir à −6 % ou +20 %) — la banque du jeu (`HISTOIRES`, js/histoires.js) fait foi sur les chiffres, ces fiches sur le fond ; les quatre protections (14, 15, 38) se prouvent par leur facteur, elles ne se voient qu'à l'infirmerie.

## 1. Le constat

**La banque d'aujourd'hui** : treize histoires dans `DOSSIERS`, toutes au lundi. Six voix parlent (an, en, ca, ph, pr, eq) ; onze sont muettes dans les histoires (pt, fi, ad, ag, co, li, pa, ma, me, dg, dp — pt parle dans les fils, me/dg/dp dans À faire, ad au duel). Les répliques (`mots`) sont deux phrases fixes qui ne nomment personne ; seul le `fait` nomme. Aucune ne lit la vraie saison. `f.blesses` et `f.masse` sont posés chaque lundi et personne ne les lit ; `f.coach.adjoints` non plus. Les faits sont écrits dans l'écran (js/saison.js).

**Le rythme** : `node scripts/mesure_rythme.mjs` a dépassé quatre minutes sur cette machine (coupé) ; le devis § 3 donne le dernier chiffre : trou médian 10 matchs, 8,7 histoires par saison, avec 14,3 lundis à histoire tirés en moyenne. La banque est courte d'environ cinq histoires vraies par saison, et une run de trois saisons revoit les treize mêmes.

**Les treize : ce qui reste, ce qui se refait.** Toutes se refont pour la forme (une `mots(f, j)` qui nomme, un `moment`, des options en cartes de la grammaire) ; sur le fond :
- Restent telles quelles (le fait, les options, la paire pesée en nov.) : 📸 la vedette, 🥶 la disette, 🥅 le gardien battu, 🥊 la chicane, 🧳 la route, 📉 la course perdue, 🏔 la première place, 🐣 le petit, 🌧 le petit doute, 🛫 le dos-à-dos.
- Se refont : 🌟 **le petit est arrivé** (une carte d'adjoint, que le robot pèse 0,5 V, contre 25 🪙 à 0,25 : la carte domine ; je monte la une à 30 🪙 + 3 xp) ; 🧊 **le blanchissage** (« Encore le filet » ≈ −0,08 V contre +0,15 pour « Retour au partant » : le dé est un piège léger, je ramène le perd à ×1,1 et l'auxiliaire à un soir) ; 🎩 **les chapeaux** (30 🪙 contre un dé à ≈ +0,10 : j'ajoute une suite au dé pour que l'audace rapporte quelque chose qu'on raconte).
- Changent de voix pour que les voix soient des personnages : 🐣 le petit passe au **dépisteur** (c'est lui qui l'a vu venir), 🛫 le dos-à-dos passe à **ton adjoint** (qui fait l'alignement du deuxième soir) ; l'entraîneur garde la disette, le gardien battu, le blanchissage.
- Doublons à ne pas gonfler (devis) : la route (🧳, 🛫), le petit (🐣 🌟 🌧), la chaude (🎩 📸), la disette (🥶). Aucune fiche neuve dans ces familles.

**La vraie saison** (`f.vraie(cle)` : `{ buts, passes, gp, matchsDeSaSaison, clubs, enCours }`) se dit par un seul gabarit, `vraie(j)` : « cette année-là, 34 buts en 47 matchs », « avec Boston » seulement si `clubs === 1`, « jusqu'ici, 12 buts en 30 matchs » si `enCours`, jamais « a fini ». Elle se dit du joueur nommé seul, comme ce qu'il était ; jamais à côté de la vraie saison d'un autre joueur, jamais comme une cible pour chez toi. Pour un gardien, il faut deux champs de plus (`victoires`, `arrets` en %) — à trancher (§ 4).

**Le poids des options** (ce que je prends pour peser à moins de 0,3 V ; le juge reste `check_effets DETAIL=1`, le robot `cartes_robot`) : 10 🪙 ≈ 0,10 V ; 1 xp ≈ 0,05 ; jambes +10 à tous ≈ 0,20 ; un match d'absence d'un régulier ≈ −0,06, un soir de l'auxiliaire ≈ −0,05, un match d'infirmerie de moins ≈ +0,06 ; une carte d'adjoint ≈ 0,5 ; sur le joueur nommé, 8 matchs : tirs ×1,5 ≈ +0,15, précision ×1,3 ≈ +0,15, précision ×0,6 ≈ −0,20 ; chez un gardien, buts accordés ×0,8 ≈ +0,025 par départ, ×1,2 ≈ −0,10 (l'asymétrie mesurée en nov. : un dé de gardien à pile ou face est un piège, je le mets à 4/6 ou je ramène le perd à ×1,1). Tout ce qui suit est « ≈, à peser ».

**Le niveau d'une option** suit son poids : Soutien (0) le sûr sous 0,2 V, Régulier (1) le dé ordinaire ou le sûr sous 0,3, Pilier (2) ce qui dure vingt matchs ou vaut une carte d'adjoint (≤ 1,5 V), ★ Étoile (3) ce qui porte une ronde entière ou une saison (≤ 2,5 V). Aucun ★ Phénomène : une histoire ne casse pas le jeu seule.

---

## 2. Les quarante fiches

Conventions : `f` les faits de `faitsDe(ligue, jour)` (js/faits.js) ; `j` le joueur nommé `{ n, cle }` plus ce que son fait porte ; `vraie(j)` le gabarit ci-dessus ; un champ marqué **(neuf)** est à ajouter à faits.js, les autres existent dans `faitsDuLundi`. Les options : `clé · nom · niveau · effet · ce qu'on voit`. Les issues de pari ne portent que `{ duree, lui }` (la règle de `check_histoires` tient). Les jetons et l'expérience sont à la décision, jamais dans une issue.

### Le lundi (28)

### 1. 📸 Tout le monde veut la vedette
**Voix** an · **Moment** lundi · **Famille** vedette (chaude)
**Le fait** : `f => !!f.vedette && f.n >= 5` ; champ `f.vedette` (ton meilleur pointeur des dix derniers matchs, `joueurDuFait`) ; joueur `f.vedette`.
**La réplique** : « {nom}, {pts} points en {m} matchs. {vraie(j)} : les commanditaires savent compter aussi. »
**Le fait sous elle** : « 7e sur 32 après 18 matchs · Lafleur : 14 points en 10 matchs · cette année-là, 56 buts en 80 matchs avec Montréal »
**Les options** :
- `medias` · La tournée des médias · Soutien · `{ jetons: 20 }` · +20 🪙 (≈ 0,20 V)
- `glace` · Le garder pour la glace · Soutien · `{ xp: 5 }` · ton coach +5 d'expérience (≈ 0,25 V)
**L'issue** : la caisse et le niveau du coach à Hier soir ; aucun suivi (rien ne touche le match). Le verso de sa carte : « Semaine 6 : la une l'a vendu aux caméras ».
**Le juge** : check_histoires, check_mots, check_effets.

### 2. 🥶 La disette
**Voix** en · **Moment** lundi · **Famille** contrat (disette)
**Le fait** : `f => !!f.muet && f.n >= 8` ; champ `f.muet` (un des trois plus gros contrats, ≤ 1 point sur ses 8 à 10 derniers matchs) ; joueur `f.muet`.
**La réplique** : « {nom} est payé {sal} et il a {pts} point{s} en {m} matchs. {vraie(j)}, alors je sais qu'il sait où est le filet. Moi, je le brasserais devant les journalistes ; toi, tu signes. »
**Le fait sous elle** : « Bure : 7,5 M$ · 1 point en 10 matchs · cette année-là, 60 buts en 63 matchs »
**Les options** :
- `defi` · Le mettre au défi devant les journalistes · Régulier · `{ pari: { chance: 3/6, gagne: { duree: 8, lui: { lancers: 1.5, finition: 1.3 } }, perd: { duree: 8, lui: { lancers: 1.5, finition: 0.5 } } } }` · 🎲 sur 4, 5 ou 6 : ses tirs +50 %, sa précision +30 % ; sinon ses tirs +50 %, sa précision −50 % (≈ +0,14 V)
- `repos` · Le reposer deux matchs · Soutien · `{ gestes: { absents: 2 }, duree: 8, lui: { lancers: 1.5, finition: 1.1 } }` · il manque 2 matchs, puis ses tirs +50 % et sa précision +10 % (≈ +0,07 V)
**L'issue** : le lundi d'après, le suivi dit ses tirs et ses buts sur les matchs joués depuis, contre ses dix d'avant ; le dé dit gagné ou perdu. Un galon « buts » rattrapé plus tard le rappelle au verso.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis.

### 3. 🥅 Le gardien battu
**Voix** en · **Moment** lundi · **Famille** gardien
**Le fait** : `f => !!f.gardien && !!f.dernier && f.dernier.contre >= 5` ; champs `f.gardien` (le gardien du dernier soir, ses tirs reçus), `f.dernier` ; joueur `f.gardien`.
**La réplique** : « {nom} en a mangé {contre} contre {adv}. Tu le renvoies devant le filet, ou tu lui donnes deux soirs pour y repenser. »
**Le fait sous elle** : « 2–6 contre Boston · Roy : 6 buts sur 31 tirs ce soir-là »
**Les options** :
- `renvoyer` · Le renvoyer devant le filet · Régulier · `{ pari: { chance: 4/6, gagne: { duree: 6, lui: { arrets: 0.8 } }, perd: { duree: 6, lui: { arrets: 1.12 } } } }` · 🎲 sur 3 à 6 : les buts qu'il accorde −20 % ; sinon +12 % (≈ 0 V ; le 3/6 à ×1,22 d'aujourd'hui pèse −0,17, c'est un piège)
- `auxiliaire` · L'auxiliaire deux soirs · Soutien · `{ gestes: { gardienAux: 2 }, duree: 4, lui: { arrets: 0.78 } }` · l'auxiliaire au filet 2 matchs, puis les buts qu'il accorde −22 % sur ses deux départs (≈ −0,01 V)
**L'issue** : le suivi lit son % d'arrêts sur ses départs depuis ; Hier soir dit chaque départ de l'auxiliaire.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis.

### 4. 🥊 La chicane au vestiaire
**Voix** ca · **Moment** lundi · **Famille** vestiaire (discipline)
**Le fait** : `f => !!f.puni` ; champ `f.puni` (≥ `PUNITIONS_CHICANE` punitions sur ses dix derniers) ; joueur `f.puni`.
**La réplique** : « {nom}, {pun} punitions en {m} matchs. Il nous coûte des avantages numériques, et les gars commencent à le lui dire en face. »
**Le fait sous elle** : « Domi : 5 punitions en 9 matchs »
**Les options** :
- `suspendre` · Le suspendre deux matchs · Soutien · `{ gestes: { absents: 2 }, xp: 4 }` · il manque 2 matchs, ton coach +4 (≈ +0,08 V)
- `amende` · Une amende · Soutien · `{ jetons: 8 }` · +8 🪙 (≈ +0,08 V)
**L'issue** : ses punitions sur ses matchs depuis, à la une s'il récidive ; Hier soir dit les deux soirs sans lui.
**Le juge** : check_histoires, check_mots, check_effets, check_incidents.

### 5. 🧳 La semaine sur la route
**Voix** ph · **Moment** lundi · **Famille** route
**Le fait** : `f => f.visiteur >= 3 && !!f.pire` ; champs `f.visiteur`, `f.jambes`, `f.pire` ; joueur `f.pire`.
**La réplique** : « Trois soirs à l'étranger, et {nom} est déjà à {j} de jambes. Un vol nolisé, et je te le rends frais ; l'autobus, et il arrive au troisième soir sur les genoux. »
**Le fait sous elle** : « 3 matchs à l'étranger cette semaine · jambes 84 · Gainey : 71 »
**Les options** :
- `nolise` · Le vol nolisé · Soutien · `{ jetons: -15, gestes: { energieTous: 10 } }` · −15 🪙, toute l'équipe jambes +10 (≈ +0,05 V)
- `autobus` · L'autobus de nuit · Soutien · `{ jetons: 10, gestes: { energieTous: -8 } }` · +10 🪙, jambes −8 (≈ −0,06 V)
**L'issue** : les jambes du matin sous chaque carte des Lignes ; Hier soir dit la fiche de la semaine sur la route.
**Le juge** : check_histoires, check_mots, check_effets.

### 6. 📉 La course perdue d'avance
**Voix** pr · **Moment** lundi · **Famille** course · **Rare** (après 41 matchs ; une fois par saison)
**Le fait** : `f => f.n >= 41 && f.retard >= 8 && !!f.vedette` ; champs `f.retard` (`faitsDeLaCourse`), `f.vedette` ; joueur `f.vedette`.
**La réplique** : « {rang}e, à {retard} points des séries. Les billets ne se vendent plus. Vous vendez la fin de saison, ou vous la jouez autour de {nom} ? »
**Le fait sous elle** : « 26e sur 32 après 47 matchs, à 11 points des séries · Hull : 12 points en 10 matchs »
**Les options** :
- `vendre` · Vendre la fin de saison · Soutien · `{ jetons: 20 }` · +20 🪙 (≈ 0,20 V)
- `battre` · Se battre jusqu'au bout · Régulier · `{ pari: { chance: 4/6, gagne: { duree: 10, lui: { lancers: 1.5, finition: 1.3 } }, perd: { duree: 10, lui: { finition: 0.6 } } } }` · 🎲 sur 3 à 6 : ses tirs +50 %, sa précision +30 % ; sinon sa précision −40 % (≈ +0,13 V)
**L'issue** : le suivi sur ses dix matchs ; le mandat au Proprio recompte le retard chaque matin.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis.

### 7. 🏔 La première place à défendre
**Voix** ca · **Moment** lundi · **Famille** course · **Rare**
**Le fait** : `f => f.n >= 41 && f.rang === 1 && f.avance !== null && !!f.pire` ; champs `f.avance`, `f.pire` ; joueur `f.pire`.
**La réplique** : « Premiers, {avance} point{s} devant le deuxième. Les gars veulent écraser la ligue ; moi, je regarde {nom} à {j} de jambes et je garderais du jus pour avril. »
**Le fait sous elle** : « 1er sur 32 après 50 matchs, 6 points devant le 2e · jambes 86 · Robinson : 74 »
**Les options** :
- `menager` · Ménager les jambes pour les séries · Régulier · `{ gestes: { energieTous: 10 } }` · toute l'équipe jambes +10 (≈ 0,20 V)
- `pedale` · La pédale au fond · Soutien · `{ jetons: 25, gestes: { energieTous: -5 } }` · +25 🪙, jambes −5 (≈ 0,15 V)
**L'issue** : les jambes aux Lignes ; l'avance au Classement chaque matin.
**Le juge** : check_histoires, check_mots, check_effets.

### 8. 🐣 Le petit qui pousse
**Voix** dp (c'était en) · **Moment** lundi · **Famille** recrue (petit) · plante la suite 9 ou 10
**Le fait** : `f => !!f.pousse && f.n >= 5` ; champ `f.pousse` (un avant du 3e ou 4e trio, ≥ 4 points sur ses derniers) ; joueur `f.pousse`.
**La réplique** : « Je l'avais dit pour {nom} : {pts} points en {m} matchs, au {ou}. {vraie(j)}. Il frappe à la porte, tu lui ouvres ? »
**Le fait sous elle** : « Lemieux : 5 points en 7 matchs, au 3e trio · cette année-là, 11 buts en 44 matchs »
**Les options** :
- `monter` · Lui donner du temps de glace · Régulier · `{ pari: { chance: 3/6, gagne: { duree: 8, lui: { lancers: 1.4, finition: 1.2 } }, perd: { duree: 8, lui: { finition: 0.6 } } }, suite: 8 }` · 🎲 sur 4, 5 ou 6 : ses tirs +40 %, sa précision +20 % ; sinon −40 % ; une suite dans 8 matchs (≈ +0,05 V, plus la suite)
- `murir` · Le laisser mûrir · Soutien · `{ xp: 4 }` · ton coach +4 (≈ 0,20 V)
**L'issue** : le suivi sur 8 matchs ; la suite 9 s'ouvre à 4 points ou plus (`POINTS_PETIT`) sur les 8, la 10 en dessous.
**Le juge** : check_histoires (la suite passe avant le tirage), check_mots, check_effets, check_suivis.

### 9. 🌟 Le petit est arrivé
**Voix** an · **Moment** lundi · **Famille** recrue · **Suite de** 8 (`monter`, ≥ 4 points en 8 matchs)
**Le fait** : `f => { const x = suiteDe(f, 'lePetit'); return !!x && x.m >= 8 && x.pts >= 4; }` ; champ `f.suites` ; joueur `x.joueur`.
**La réplique** : « {nom}, {pts} points en {m} matchs depuis qu'il joue plus. Tout le monde parle de lui à la télé ; le petit est devenu quelqu'un. »
**Le fait sous elle** : « Lemieux : 7 points en 8 matchs depuis qu'il joue plus »
**Les options** :
- `une` · La une le réclame · Régulier · `{ jetons: 30, xp: 3 }` · +30 🪙, ton coach +3 (≈ 0,45 V ; c'était 25 🪙 seul, dominé par la carte)
- `proteger` · Le protéger des caméras · Pilier · `{ gestes: { adjoint: true } }` · une carte d'adjoint parmi trois dans ta main (≈ 0,5 V)
**L'issue** : la carte dans la main (Bureau › Coach) ou la caisse ; le verso de sa carte garde « Le petit est arrivé, semaine 14 ».
**Le juge** : check_histoires, check_mots, check_effets.

### 10. 🌧 Le petit doute
**Voix** ca · **Moment** lundi · **Famille** recrue · **Suite de** 8 (`monter`, < 4 points en 8 matchs)
**Le fait** : `f => { const x = suiteDe(f, 'lePetit'); return !!x && x.m >= 8 && x.pts < 4; }` ; joueur `x.joueur`.
**La réplique** : « {nom}, {pts} point{s} en {m} matchs depuis qu'on l'a monté. Il ne dort plus, il regarde ses présences en boucle. Je peux le prendre sous mon aile. »
**Le fait sous elle** : « Lemieux : 1 point en 8 matchs depuis qu'il joue plus »
**Les options** :
- `aile` · Sous l'aile du capitaine · Régulier · `{ duree: 6, lui: { lancers: 1.3, finition: 1.2 }, gestes: { energie: -15 } }` · ses tirs +30 %, sa précision +20 % sur 6 matchs, ses jambes −15 (≈ +0,12 V)
- `redescendre` · Le renvoyer en bas de l'alignement · Soutien · `{ xp: 3 }` · ton coach +3 (≈ 0,15 V)
**L'issue** : le suivi sur 6 matchs.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis.

### 11. 🎩 Les chapeaux sur la glace
**Voix** eq · **Moment** lundi · **Famille** chaude · **Rare**
**Le fait** : `f => !!f.chapeau` ; champ `f.chapeau` (`faitsDuDernier` : trois buts au dernier match) ; joueur `f.chapeau`.
**La réplique** : « {nom}, {buts} buts hier contre {adv}. J'en ai ramassé une pleine poubelle de chapeaux. On en fait quoi ? »
**Le fait sous elle** : « Bossy : 3 buts au dernier match, 6–2 contre Québec »
**Les options** :
- `encheres` · Les chapeaux aux enchères · Régulier · `{ jetons: 30 }` · +30 🪙 (≈ 0,30 V)
- `chaud` · Il garde la rondelle chaude · Régulier · `{ pari: { chance: 4/6, gagne: { duree: 6, lui: { lancers: 1.5, finition: 1.3 } }, perd: { duree: 6, lui: { finition: 0.7 } } } }` · 🎲 sur 3 à 6 : ses tirs +50 %, sa précision +30 % ; sinon −30 % (≈ +0,15 V ; c'était ×1,4/×1,2, ≈ 0,10, trop loin de 30 🪙)
**L'issue** : le suivi sur 6 matchs ; le fil « la chaude » à la une s'il remarque.
**Le juge** : check_histoires (rare, une fois), check_mots, check_effets, check_suivis.

### 12. 🧊 Le blanchissage de l'auxiliaire
**Voix** en · **Moment** lundi · **Famille** gardien
**Le fait** : `f => !!f.blanchissage` ; champ `f.blanchissage` (le gardien du dernier soir n'est pas ton partant et n'a rien accordé) ; joueur `f.blanchissage`.
**La réplique** : « {nom} a fermé la porte, {pour}–0 contre {adv}, et le grand regarde du banc. Un blanchissage, ça se récompense ; ou ça se range, et on revient à l'ordre. »
**Le fait sous elle** : « Hackett : un blanchissage, 3–0 contre Chicago »
**Les options** :
- `encore` · Encore le filet · Régulier · `{ gestes: { gardienAux: 1 }, pari: { chance: 4/6, gagne: { duree: 3, lui: { arrets: 0.8 } }, perd: { duree: 3, lui: { arrets: 1.1 } } } }` · l'auxiliaire au filet 1 match ; 🎲 sur 3 à 6 : les buts qu'il accorde −20 % ; sinon +10 % (≈ 0 V ; c'était deux soirs et ×1,2, ≈ −0,08)
- `partant` · Retour au partant · Soutien · `{ xp: 3 }` · ton coach +3 (≈ 0,15 V)
**L'issue** : le suivi sur ses départs depuis ; le galon « 30 victoires » du partant compte un départ de moins.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis.

### 13. 🛫 Deux soirs de suite sur la route
**Voix** ad (c'était en) · **Moment** lundi · **Famille** route
**Le fait** : `f => f.n >= 41 && f.dosRoute >= 1 && !!f.pire` ; champs `f.dosRoute`, `f.pire` ; joueur `f.pire`.
**La réplique** : « Deux villes, deux soirs, et {nom} traîne déjà la patte à {j}. Je l'habille les deux soirs, ou je le laisse à l'hôtel le deuxième ? »
**Le fait sous elle** : « Un dos-à-dos à l'étranger cette semaine · jambes 81 · Savard : 69 »
**Les options** :
- `hotel` · Le laisser souffler un soir · Soutien · `{ gestes: { absents: 1, energie: 35 } }` · il manque 1 match, ses jambes +35 (≈ +0,05 V)
- `embarque` · Il joue les deux soirs · Régulier · `{ pari: { chance: 3/6, gagne: { duree: 6, lui: { lancers: 1.5, finition: 1.15 } }, perd: { duree: 6, lui: { finition: 0.6 } } } }` · 🎲 sur 4, 5 ou 6 : ses tirs +50 %, sa précision +15 % ; sinon −40 % (≈ +0,02 V)
**L'issue** : le suivi sur 6 matchs ; les jambes aux Lignes le matin du deuxième soir.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis.

### 14. 🧠 La commotion
**Voix** me · **Moment** lundi · **Famille** blessure
**Le fait** : `f => !!f.blesses.find(b => b.genre === 'commotion' && b.m >= 4)` ; champ `f.blesses[i].genre` **(neuf : le `genre` du registre `injuriesLog`, et `b.deja`, ses commotions d'avant dans la run, `t.commotions`)** ; joueur ce blessé.
**La réplique** : « {nom}, {m} matchs encore. {deja ? 'Sa deuxième commotion chez nous ; la prochaine sera plus longue.' : 'Une commotion, ça ne se négocie pas avec moi.'} Le protocole au complet, ou je le lâche dès qu'il passe les tests. »
**Le fait sous elle** : « Lindros : une commotion cérébrale, 9 matchs d'absence encore (14 en tout) · 2e de la run »
**Les options** :
- `protocole` · Le protocole au complet · Pilier · `{ duree: 20, lui: { blessure: 0.5 } }` · ses blessures −50 % sur 20 matchs à son retour (≈ +0,15 V : il ne manque pas la suite)
- `tests` · Dès qu'il passe les tests · Régulier · `{ gestes: { soin: 3 }, pari: { chance: 4/6, gagne: { duree: 8, lui: { lancers: 1.2 } }, perd: { duree: 8, lui: { blessure: 2, finition: 0.8 } } } }` · −3 matchs d'infirmerie ; 🎲 sur 3 à 6 : ses tirs +20 % ; sinon ses blessures ×2 et sa précision −20 % (≈ +0,18 − risque ≈ +0,10 V)
**L'issue** : le suivi dit le match de son retour et s'il s'est reblessé depuis (la mémoire des commotions : « Jouer blessé » dans vocabulaire.md) ; l'infirmerie au filtre 🩹.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis, check_incidents.

### 15. 🩹 Le retour devancé
**Voix** ph · **Moment** lundi · **Famille** blessure
**Le fait** : `f => !!f.blesses.find(b => b.genre !== 'commotion' && b.genre !== 'fracture' && b.genre !== 'ligaments' && b.m >= 3 && b.m <= 6)` ; champs `f.blesses` (`m` restants), `genre` (neuf) ; joueur ce blessé (le plus proche du retour).
**La réplique** : « {nom} est à mi-chemin : {m} matchs encore sur sa table. Je peux le remettre sur ses patins jeudi, mais une aine, ça se rappelle à toi. »
**Le fait sous elle** : « Sakic : une élongation à l'aine, 4 matchs d'absence encore (9 en tout) · 1er trio »
**Les options** :
- `devancer` · Le remettre jeudi · Régulier · `{ gestes: { soin: 2 }, duree: 8, lui: { blessure: 1.6 } }` · −2 matchs d'infirmerie, ses blessures +60 % sur 8 matchs (≈ +0,12 − 0,05 ≈ +0,07 V)
- `guerir` · Le laisser guérir · Soutien · `{ xp: 3, duree: 10, lui: { blessure: 0.7 } }` · ton coach +3, ses blessures −30 % sur 10 matchs à son retour (≈ +0,15 + 0,03 ≈ +0,18 V)
**L'issue** : le suivi dit son retour et ses matchs joués depuis sans rechute ; Hier soir dit le jour où il rentre.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis, check_incidents.

### 16. 🧾 La prime au contrat
**Voix** fi · **Moment** lundi · **Famille** contrat
**Le fait** : `f => !!f.jalon` ; champ `f.jalon` **(neuf : un de tes joueurs qui a passé 20 buts ou 40 points chez toi cette semaine, `{ n, cle, quoi: 'buts'|'points', total, m, sal }` — les crans de `FILS.jalon` de js/recit.js, lus dans tes feuilles)** ; joueur `f.jalon`.
**La réplique** : « {nom} vient de passer {total} {quoi} chez nous, et son contrat de {sal} a une prime écrite pour ça. Je la paie tout de suite, ou je l'étale et il le saura. »
**Le fait sous elle** : « Kurri : 20e but au 38e match · 4,2 M$ · une prime au contrat »
**Les options** :
- `payer` · La payer rubis sur l'ongle · Régulier · `{ jetons: -15, duree: 10, lui: { lancers: 1.3, finition: 1.15 } }` · −15 🪙, ses tirs +30 % et sa précision +15 % sur 10 matchs (≈ −0,15 + 0,22 ≈ +0,07 V)
- `etaler` · L'étaler jusqu'en avril · Régulier · `{ pari: { chance: 3/6, gagne: { duree: 10, lui: { finition: 1.2 } }, perd: { duree: 10, lui: { finition: 0.8, lancers: 0.85 } } } }` · 🎲 sur 4, 5 ou 6 : sa précision +20 % ; sinon −20 % et ses tirs −15 % (≈ 0,5 × 0,12 − 0,5 × 0,18 ≈ −0,03 V)
**L'issue** : le suivi sur 10 matchs ; la caisse au Proprio ; le galon 🏵 « Le marqueur » s'il va jusqu'à 40.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis, check_fils (le jalon est un vrai cran).

### 17. 🤝 Son agent appelle
**Voix** ag · **Moment** lundi · **Famille** contrat · **Rare**
**Le fait** : `f => f.n >= 15 && !!f.vedette && f.vedette.sal != null` ; champs `f.vedette`, `f.vraie(vedette)` **(neuf)** ; joueur `f.vedette`.
**La réplique** : « Mon client, {nom} : {pts} points en {m} matchs chez vous. {vraie(j)}. Il veut qu'on en parle avant le printemps, et il préfère qu'on en parle maintenant. »
**Le fait sous elle** : « Hull : 13 points en 10 matchs · 3,0 M$ · cette année-là, 86 buts en 78 matchs avec St. Louis »
**Les options** :
- `donner` · Lui donner ce qu'il demande · Régulier · `{ jetons: -20, duree: 12, lui: { lancers: 1.3, creation: 1.2 } }` · −20 🪙, ses tirs +30 % et ses passes +20 % sur 12 matchs (≈ −0,20 + 0,25 ≈ +0,05 V)
- `gagner` · Qu'il le gagne sur la glace · Régulier · `{ pari: { chance: 3/6, gagne: { duree: 12, lui: { lancers: 1.3, finition: 1.3 } }, perd: { duree: 12, lui: { finition: 0.75, creation: 0.8 } } } }` · 🎲 sur 4, 5 ou 6 : ses tirs +30 %, sa précision +30 % ; sinon précision −25 %, passes −20 % (≈ 0,5 × 0,35 − 0,5 × 0,25 ≈ +0,05 V)
**L'issue** : le suivi sur 12 matchs, et l'agent revient à la une si le dé est perdu (« Son agent rappelle », une ligne d'Hier soir, pas une histoire).
**Le juge** : check_histoires (rare), check_mots, check_effets, check_suivis, check_vie (la vraie saison).

### 18. ⏳ La date limite des échanges
**Voix** dg · **Moment** lundi · **Famille** contrat · **Rare** (entre le 48e et le 58e match)
**Le fait** : `f => f.n >= 48 && f.n <= 58 && !!f.masse && !!f.masse.lourd && f.masse.espace < f.masse.cap * 0.03` ; champ `f.masse` (`espace`, `lourd`, **`cap` neuf**) ; joueur `f.masse.lourd`.
**La réplique** : « La date limite est vendredi, et on est à {libre} du plafond. J'ai une offre pour {nom} : {sal}, {pts} points en {m} matchs. {vraie(j)}. Je l'écoute ou je raccroche ? »
**Le fait sous elle** : « 51e match · espace libre 0,4 M$ · Lindros : 8,5 M$ · 6 points en 10 matchs · cette année-là, 47 buts en 73 matchs »
**Les options** :
- `echanger` · L'échanger · Pilier · `{ gestes: { echange: 'lui', offres: 2 } }` · {nom} part ; deux joueurs de son époque offerts, un signé, sous le plafond (≈ 0 à +0,5 V selon l'offre — **un geste neuf**, § 4 q. 3)
- `garder` · On garde le groupe · Régulier · `{ xp: 4, duree: 10, lui: { lancers: 1.25 } }` · ton coach +4, ses tirs +25 % sur 10 matchs (≈ 0,20 + 0,12 ≈ +0,32 V)
**L'issue** : la signature ouvre l'échange (Signer, c'est l'échange) ; le suivi sur 10 matchs s'il reste ; le verso de sa carte dit « Gardé à la date limite, saison 2 ».
**Le juge** : check_histoires, check_mots, check_effets, check_suivis, check_rogue (la masse après l'échange).

### 19. 🎯 Le séjour gagnant
**Voix** ad · **Moment** lundi · **Famille** adjoint
**Le fait** : `f => !!f.sejourFini && f.sejourFini.v > f.sejourFini.d && !!f.vedette` ; champ `f.sejourFini` **(neuf : le dernier de `you.sejoursFinis` de la semaine, `{ cle, nom, ico, niveau, v, d, dp, debut, fin }`)** ; joueur `f.vedette` (celui qui a porté le séjour aux points).
**La réplique** : « {ico} {adjoint}, c'est fini : {v}-{d}-{dp} en {matchs} matchs, et {nom} qui a tout mis dedans. Il m'a laissé un nom pour la main, ou un cahier pour le coach. »
**Le fait sous elle** : « 🏹 Le canonnier · 12 matchs, 8-3-1 · Kurri : 15 points en 10 matchs »
**Les options** :
- `nom` · Il recommande quelqu'un · Pilier · `{ gestes: { adjoint: true } }` · une carte d'adjoint parmi trois (≈ 0,5 V)
- `cahier` · Son cahier au coach · Pilier · `{ xp: 8 }` · ton coach +8 (≈ 0,40 V)
**L'issue** : la main au Bureau › Coach ; Hier soir dit déjà la fiche du séjour ; la carte d'adjoint garde sa fiche (« 2 séjours · 15-7-2 »).
**Le juge** : check_histoires, check_mots, check_effets, check_pouvoirs (la main tient 4).

### 20. 🪑 Le séjour qui a raté
**Voix** ca · **Moment** lundi · **Famille** adjoint
**Le fait** : `f => !!f.sejourFini && f.sejourFini.d > f.sejourFini.v && !!f.pire` ; champ `f.sejourFini` (neuf) ; joueur `f.pire`.
**La réplique** : « {ico} {adjoint} est parti sur {v}-{d}-{dp}. Les gars n'ont jamais embarqué dans son style, et {nom} est à {j} de jambes à force de courir après. On revient à nos affaires. »
**Le fait sous elle** : « 🏋 Le cogneur · 12 matchs, 4-7-1 · jambes 82 · Chelios : 70 »
**Les options** :
- `base` · Retour aux trios d'avant · Soutien · `{ gestes: { energieTous: 8 } }` · toute l'équipe jambes +8 (≈ 0,16 V)
- `lecon` · Le coach encaisse la leçon · Soutien · `{ xp: 5, gestes: { energie: -10 } }` · ton coach +5, {nom} jambes −10 (il patine le lendemain) (≈ 0,25 − 0,03 ≈ 0,22 V)
**L'issue** : les jambes aux Lignes ; la carte au repos 20 matchs (sa fiche dit le séjour perdant).
**Le juge** : check_histoires, check_mots, check_effets.

### 21. 🏢 Le mandat, à mi-chemin
**Voix** pr · **Moment** lundi · **Famille** mandat · **Rare** (après 41 matchs)
**Le fait** : `f => f.n >= 41 && !!f.mandat && f.mandat.rang != null && f.rang > f.mandat.rang && f.retard < 8 && !!f.vedette` ; champ `f.mandat` **(neuf : `{ mot, rang: rangDuMandat(mandatDe(...)) }`, js/rogue.js)** ; joueur `f.vedette`.
**La réplique** : « Je vous ai demandé de {mot}. Vous êtes {rang}e à {n} matchs. J'ouvre le coffre une fois, ou je veux un mois de {nom} ; pas les deux. »
**Le fait sous elle** : « 13e sur 32 après 44 matchs · le mandat : finir dans les dix premiers · Yzerman : 11 points en 10 matchs »
**Les options** :
- `coffre` · Il ouvre le coffre · Régulier · `{ jetons: 25 }` · +25 🪙 (≈ 0,25 V)
- `mois` · Un mois de {nom} · Régulier · `{ pari: { chance: 4/6, gagne: { duree: 12, lui: { lancers: 1.4, finition: 1.25 } }, perd: { duree: 12, lui: { finition: 0.7 } } } }` · 🎲 sur 3 à 6 : ses tirs +40 %, sa précision +25 % ; sinon −30 % (≈ 0,67 × 0,35 − 0,33 × 0,25 ≈ +0,15 V)
**L'issue** : le suivi sur 12 matchs ; la jauge du mandat au Proprio chaque matin ; le verdict du proprio à la fin de la saison le rappelle.
**Le juge** : check_histoires (rare), check_mots, check_effets, check_suivis, check_clarte (le mandat dit le même mot qu'au Proprio).

### 22. 🧤 Trente victoires en vue
**Voix** pt · **Moment** lundi · **Famille** gardien (galon)
**Le fait** : `f => !!f.murEnVue` ; champ `f.murEnVue` **(neuf : ton gardien à 26-29 victoires chez toi cette saison, `{ n, cle, v, departs }`, compté comme `galonsDeLaSaison`)** ; joueur ce gardien.
**La réplique** : « {nom} en a {v}. Les gradins comptent à voix haute à chaque arrêt, et on veut le trentième à la maison. Tu le lances jusqu'à ce qu'il l'ait, ou tu le laisses respirer un soir ? »
**Le fait sous elle** : « Dryden : 28 victoires en 46 départs · 2 avant le galon 🏵 Le mur »
**Les options** :
- `jusquau` · Tous les départs jusqu'au trentième · Régulier · `{ pari: { chance: 4/6, gagne: { duree: 4, lui: { arrets: 0.85 } }, perd: { duree: 4, lui: { arrets: 1.1 } } } }` · 🎲 sur 3 à 6 : les buts qu'il accorde −15 % ; sinon +10 % (≈ 0,67 × 0,06 − 0,33 × 0,2 ≈ −0,03 V)
- `respire` · Un soir à l'auxiliaire, puis frais · Soutien · `{ gestes: { gardienAux: 1 }, duree: 3, lui: { arrets: 0.85 } }` · l'auxiliaire 1 match, puis les buts qu'il accorde −15 % sur 3 départs (≈ −0,05 + 0,05 ≈ 0 V)
**L'issue** : le galon 🏵 « Le mur » se grave au 30e avec son match et son adversaire (verso de sa carte, panthéon) ; le suivi sur ses départs.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis, check_galons.

### 23. 🔗 Le duo
**Voix** ad · **Moment** lundi · **Famille** vestiaire (duo) · plante la suite 24
**Le fait** : `f => !!f.duo && f.n >= 10` ; champ `f.duo` **(neuf : deux de tes avants de la même ligne, ≥ 5 buts de l'un sur passes de l'autre en 10 matchs, `{ marqueur, passeur, buts, m }` — la règle de `FILS.duo`)** ; joueur `f.duo.marqueur`.
**La réplique** : « {marqueur} et {passeur} : {buts} buts ensemble en {m} matchs, un sur passe de l'autre. Ces deux-là se trouvent sans se regarder. Je les soude pour la saison, ou je garde la liberté de brasser les trios ? »
**Le fait sous elle** : « Oates → Hull : 6 buts ensemble en 10 matchs »
**Les options** :
- `souder` · Les garder ensemble · Pilier · `{ pari: { chance: 4/6, gagne: { duree: 20, lui: { finition: 1.3, creation: 1.15 } }, perd: { duree: 8, lui: { finition: 0.7 } } }, suite: 10 }` · 🎲 sur 3 à 6 : sa précision +30 %, ses passes +15 % sur 20 matchs ; sinon −30 % sur 8 ; une suite dans 10 matchs (≈ 0,67 × 0,45 − 0,33 × 0,2 ≈ +0,23 V)
- `libre` · Garder les trios libres · Soutien · `{ xp: 5 }` · ton coach +5 (≈ 0,25 V)
**L'issue** : le suivi recompte les buts du duo sur 10 matchs ; la suite 24 s'ouvre à 5 buts ensemble ou plus ; le fil « le duo » à la une.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis, check_fils.

### 24. 📢 Le duo a un nom
**Voix** co · **Moment** lundi · **Famille** vestiaire (duo) · **Suite de** 23 (`souder`, ≥ 5 buts ensemble en 10 matchs)
**Le fait** : `f => { const x = suiteDe(f, 'leDuo'); return !!x && x.m >= 10 && x.butsDuo >= 5; }` ; champ `f.suites[i].butsDuo` **(neuf : les buts du marqueur sur passe du passeur depuis)** ; joueur `x.joueur` (le marqueur).
**La réplique** : « {marqueur} et {passeur}, {butsDuo} buts ensemble en {m} matchs depuis qu'on les a soudés. Les partisans leur ont trouvé un nom, et je peux l'imprimer sur des chandails d'ici vendredi. »
**Le fait sous elle** : « Oates → Hull : 7 buts ensemble en 10 matchs depuis qu'on les garde »
**Les options** :
- `chandails` · Les chandails du duo · Régulier · `{ jetons: 30 }` · +30 🪙 (≈ 0,30 V)
- `glace` · Loin des caméras, sur la glace · Pilier · `{ xp: 3, duree: 12, lui: { creation: 1.25 } }` · ton coach +3, ses passes +25 % sur 12 matchs (≈ 0,15 + 0,15 ≈ 0,30 V)
**L'issue** : le suivi sur 12 matchs ; le verso des deux cartes garde le nom du duo et ses buts.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis.

### 25. 🐥 La recrue
**Voix** an · **Moment** lundi · **Famille** recrue · **Rare**
**Le fait** : `f => !!f.recrue && f.n >= 10` ; champ `f.recrue` **(neuf : un de tes joueurs `rk`, ≥ 10 matchs chez toi, au rythme de 40 points sur 82 — `FILS.recrue`, `{ n, cle, pts, m }`, plus `f.vraie`)** ; joueur `f.recrue`.
**La réplique** : « {nom}, {pts} points en {m} matchs, à son âge. {vraie(j)}. Le réseau veut le match des recrues, les commanditaires veulent sa face. Tu le laisses dans le cirque, ou tu fermes la porte ? »
**Le fait sous elle** : « Selänne : 9 points en 12 matchs · recrue · jusqu'ici, 76 buts en 84 matchs avec Winnipeg »
**Les options** :
- `cirque` · Le match des recrues à la télé · Régulier · `{ jetons: 20 }` · +20 🪙 (≈ 0,20 V)
- `porte` · Fermer la porte aux caméras · Régulier · `{ duree: 10, lui: { lancers: 1.2, creation: 1.2 } }` · ses tirs +20 %, ses passes +20 % sur 10 matchs (≈ 0,20 V)
**L'issue** : le suivi sur 10 matchs ; le galon 🏵 « La recrue de l'année » (40 points) se grave s'il y arrive.
**Le juge** : check_histoires (rare), check_mots, check_effets, check_suivis, check_galons, check_vie (la vraie saison, « jusqu'ici » si en cours).

### 26. 🧣 Le vieux
**Voix** pa · **Moment** lundi · **Famille** vétéran · **Rare**
**Le fait** : `f => !!f.veteran && f.n >= 20` ; champ `f.veteran` **(neuf : ton joueur le plus âgé à 35 ans ou plus dans sa saison — `ageAtSeason(p.bd, p.s)`, comme js/arcs.js —, ≥ 10 matchs chez toi, `{ n, cle, age, pts, m }`)** ; joueur `f.veteran`.
**La réplique** : « Ça fait trente ans que j'ai mon siège, et {nom}, à {age} ans, c'est le seul qui joue encore comme quand j'ai commencé. {pts} points en {m} matchs. Faites-lui une soirée avant qu'il parte. »
**Le fait sous elle** : « Howe : 41 ans · 7 points en 10 matchs · cette année-là, 15 buts en 80 matchs »
**Les options** :
- `soiree` · Une soirée en son honneur · Régulier · `{ jetons: 15, duree: 6, lui: { finition: 1.2 } }` · +15 🪙, sa précision +20 % sur 6 matchs (≈ 0,15 + 0,08 ≈ 0,23 V)
- `tranquille` · Le laisser tranquille, il joue · Régulier · `{ xp: 5 }` · ton coach +5 (≈ 0,25 V)
**L'issue** : le suivi sur 6 matchs ; le verso de sa carte garde « Soirée en son honneur, 61e match, contre Détroit ».
**Le juge** : check_histoires (rare), check_mots, check_effets, check_suivis, check_vie.

### 27. 🗳 La ville veut une fête
**Voix** ma · **Moment** lundi · **Famille** club (course) · **Rare**
**Le fait** : `f => f.serie >= 6 && !!f.vedette` ; champ `f.serie` **(neuf : tes victoires de suite, `FILS.sequence`)** ; joueur `f.vedette` (la rare histoire de club s'accroche à qui la porte).
**La réplique** : « {serie} victoires de suite, et {nom} qui remplit mes rues le soir. La ville veut un rassemblement sur la place, samedi midi. Je ferme la rue ou j'attends le défilé de juin ? »
**Le fait sous elle** : « 6 victoires de suite · Gretzky : 18 points en 10 matchs »
**Les options** :
- `place` · Le rassemblement sur la place · Régulier · `{ jetons: 25, gestes: { energieTous: -5 } }` · +25 🪙, toute l'équipe jambes −5 (≈ 0,25 − 0,10 ≈ 0,15 V)
- `juin` · Pas avant le défilé de juin · Soutien · `{ xp: 4 }` · ton coach +4 (≈ 0,20 V)
**L'issue** : la séquence à la une tant qu'elle dure, et sa fin (« Toutes les séquences finissent un jour ») ; les jambes aux Lignes.
**Le juge** : check_histoires (rare, liste blanche de check_incidents si JP la veut sans joueur), check_mots, check_effets, check_fils.

### 28. 🪪 La ligue a revu le coup
**Voix** li · **Moment** lundi · **Famille** vestiaire (discipline)
**Le fait** : `f => !!f.coup` ; champ `f.coup` **(neuf : ton joueur qui a pris une majeure ou une punition de match au dernier match, `{ n, cle, min, adv }`, lu dans `feuille.punitions`)** ; joueur `f.coup`.
**La réplique** : « La ligue a revu le geste de {nom} contre {adv}, {min} minutes au cachot. Deux matchs, ou vous plaidez sa cause par téléphone et il joue mercredi. »
**Le fait sous elle** : « Domi : une majeure de 5 minutes contre Boston · 24e match »
**Les options** :
- `accepter` · Accepter la suspension · Soutien · `{ gestes: { absents: 2 }, xp: 4 }` · il manque 2 matchs, ton coach +4 (≈ −0,12 + 0,20 ≈ +0,08 V)
- `plaider` · Plaider sa cause · Régulier · `{ jetons: -8, duree: 6, lui: { lancers: 1.3 } }` · −8 🪙, ses tirs +30 % sur 6 matchs (il joue enragé) (≈ −0,08 + 0,12 ≈ +0,04 V)
**L'issue** : Hier soir dit les deux soirs sans lui ; le suivi dit ses tirs et ses punitions sur 6 matchs.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis, check_incidents.

### Le jour du gros match (6)

Le moment « gros match » se lit le matin du duel (jamais la veille) sur `f.gros` **(neuf : `{ adv, sorte: 'choisi'|'nemesis', domicile, fiche: { v, d }, dernier: { pour, contre }, ancien, leurVedette, lancee, malades, partant }`)**. Une option peut poser des `canaux` sur ton club pour ce match seul (`duree: 1`), comme un plan de période ; c'est la question 4 du § 4.

### 29. 👋 Le retour de l'ancien
**Voix** dp · **Moment** gros match · **Famille** vestiaire (rivalité)
**Le fait** : `f => !!f.gros && !!f.gros.ancien` ; champ `f.gros.ancien` (un joueur que tu as laissé partir dans la run, habillé chez eux ce soir — `anciensJoueurs` de js/saison.js l. 1004, nommé maintenant ; `{ n, cle, pts, m, vraie }`) ; joueur ton `f.vedette` (c'est lui qu'on vise ; l'ancien n'est pas à toi).
**La réplique** : « {ancien} joue chez eux ce soir, {pts} points en {m} matchs depuis qu'il est parti. Il a dit qu'il avait quelque chose à prouver. {nom} a entendu. »
**Le fait sous elle** : « Contre Québec, 1-1 cette saison · Hunter : 9 points en 12 matchs chez eux · Richer : 11 points en 10 matchs chez toi »
**Les options** :
- `cibler` · Le cibler · Régulier · `{ duree: 1, canaux: { robustesse: 1.5, discipline: 1.18 } }` · +4 mises en échec, +0,5 punition ce soir (≈ −0,05 V ce soir)
- `ignorer` · L'ignorer, jouer notre match · Régulier · `{ duree: 1, canaux: { defense: 0.94 } }` · −2 tirs contre ce soir (≈ +0,05 V ce soir)
**L'issue** : la feuille du duel ; Hier soir dit si l'ancien a marqué ; le verso de la carte de l'ancien (au cartable) : « Revenu contre toi, 34e match ».
**Le juge** : check_histoires, check_mots, check_effets (en paires, un soir), check_gros.

### 30. 🥅 Le gardien parle à ses poteaux
**Voix** ph · **Moment** gros match · **Famille** gardien (blessure)
**Le fait** : `f => !!f.gros && !!f.gros.partant && (f.gros.partant.j < 78 || f.gros.partant.dosADos)` ; champ `f.gros.partant` (ton partant, ses jambes du matin, s'il a joué hier) ; joueur le partant.
**La réplique** : « {nom} a ses rituels, et son aine a {j} de jambes ce matin. Je lui coupe ses poteaux et il part frais la semaine prochaine, ou il garde sa bulle ce soir et il me le paiera demain. »
**Le fait sous elle** : « Roy : jambes 72 · a joué hier · gros match contre Détroit »
**Les options** :
- `rituels` · Laisser ses rituels · Régulier · `{ duree: 1, lui: { arrets: 0.85 }, gestes: { energie: -20 } }` · les buts qu'il accorde −15 % ce soir, ses jambes −20 (≈ +0,03 − 0,05 ≈ −0,02 V)
- `auxiliaire` · L'auxiliaire prend le gros match · Régulier · `{ gestes: { gardienAux: 1 }, duree: 3, lui: { arrets: 0.85 } }` · l'auxiliaire ce soir, puis les buts qu'il accorde −15 % sur 3 départs (≈ −0,05 + 0,05 ≈ 0 V)
**L'issue** : la feuille du duel ; le suivi sur ses départs d'après.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis, check_gros.

### 31. 🦠 Le virus dans le vestiaire
**Voix** me · **Moment** gros match · **Famille** blessure
**Le fait** : `f => !!f.gros && f.gros.malades.length >= 3` ; champ `f.gros.malades` (tes patineurs sous 65 de jambes ce matin, `[{ n, cle, j }]`) ; joueur le plus bas des trois.
**La réplique** : « {noms} ont passé la nuit malades ; {nom} est à {j}. Ils peuvent jouer, « à peu près ». Aucun bon choix : lequel fait le moins mal ? »
**Le fait sous elle** : « Lemieux 58 · Jagr 62 · Francis 64 de jambes · gros match contre Washington »
**Les options** :
- `jouer` · Il joue quand même · Régulier · `{ duree: 1, lui: { lancers: 0.8 }, gestes: { energie: -20 } }` · ses tirs −20 % ce soir, ses jambes −20 (≈ −0,08 V)
- `lit` · Au lit, le remplaçant de la ligue · Soutien · `{ gestes: { absents: 1, energie: 30 } }` · il manque ce match, ses jambes +30 (≈ −0,06 + 0,05 ≈ −0,01 V)
**L'issue** : la feuille du duel ; les jambes aux Lignes le lendemain.
**Le juge** : check_histoires, check_mots, check_effets, check_incidents, check_gros.

### 32. 🔎 Leur vedette
**Voix** dp · **Moment** gros match · **Famille** course (rivalité)
**Le fait** : `f => !!f.gros && !!f.gros.leurVedette` ; champ `f.gros.leurVedette` (leur meilleur pointeur des dix derniers, lu dans leurs feuilles, `{ n, pts, m, vraie }`) ; joueur ton meilleur défenseur au différentiel des dix derniers **(neuf : `f.gros.monMur`)**.
**La réplique** : « Leur gars, c'est {leurVedette} : {pts} points en {m} matchs. {vraie(lv)}. Je mets {nom} dans ses culottes toute la soirée, ou on joue notre jeu et on le laisse venir. »
**Le fait sous elle** : « Contre Edmonton, 0-2 cette saison · Gretzky : 21 points en 10 matchs · Langway : +6 en 10 matchs »
**Les options** :
- `ombre` · L'ombre sur {leurVedette} · Régulier · `{ duree: 1, canaux: { defense: 0.93, volume: 0.97 }, lui: { blessure: 1.3 } }` · −2 tirs contre, −1 tir pour ce soir ; {nom} se blesse plus ce soir (≈ +0,03 V)
- `notre` · On joue notre jeu · Régulier · `{ duree: 1, canaux: { finition: 1.06 } }` · +0,3 but ce soir (≈ +0,05 V)
**L'issue** : la feuille du duel, les points de leur vedette à Hier soir ; la carte de {nom} garde « L'ombre sur Gretzky, 40e match ».
**Le juge** : check_histoires, check_mots, check_effets, check_gros, check_vie.

### 33. 📣 Les gradins pleins
**Voix** pt · **Moment** gros match · **Famille** course (lancée)
**Le fait** : `f => !!f.gros && f.gros.domicile && f.gros.lancee >= 3 && !!f.vedette` ; champs `f.gros.domicile`, `f.gros.lancee` (tes victoires de suite, `T._suite`) ; joueur `f.vedette`.
**La réplique** : « {lancee} de suite, et c'est plein jusqu'au plafond ce soir. On veut voir {nom} tirer de partout. Le show, ou le plan de match ? »
**Le fait sous elle** : « 4 victoires de suite · à domicile contre Toronto · Lafleur : 13 points en 10 matchs »
**Les options** :
- `show` · Donner le show · Régulier · `{ duree: 1, canaux: { volume: 1.09, defense: 1.08 } }` · +3 tirs, +2 tirs contre ce soir (≈ 0 V : la forme, pas la force)
- `plan` · Jouer notre hockey · Régulier · `{ duree: 1, canaux: { defense: 0.96 }, lui: { lancers: 1.3 } }` · −1 tir contre, ses tirs +30 % ce soir (≈ +0,05 V)
**L'issue** : la feuille du duel ; la lancée à la une si elle continue.
**Le juge** : check_histoires, check_mots, check_effets, check_gros.

### 34. 🎤 La garantie
**Voix** ca · **Moment** gros match · **Famille** vestiaire (rivalité)
**Le fait** : `f => !!f.gros && f.gros.sorte === 'nemesis' && !!f.vedette` ; champs `f.gros.sorte` (ta bête noire : ils t'ont battu deux fois), `f.gros.fiche` ; joueur `f.vedette`.
**La réplique** : « Ils nous ont battus {d} fois cette saison. Les journalistes entourent {nom}, ils attendent une phrase pour la une. Il la donne, ou on parle sur la glace ? »
**Le fait sous elle** : « Ta bête noire : New Jersey, 0-2 cette saison · Messier : 12 points en 10 matchs »
**Les options** :
- `garantir` · Il garantit la victoire · Pilier · `{ pari: { chance: 3/6, gagne: { duree: 1, lui: { lancers: 1.6, finition: 1.4 } }, perd: { duree: 4, lui: { finition: 0.6 } } } }` · 🎲 sur 4, 5 ou 6 : ses tirs +60 %, sa précision +40 % ce soir ; sinon sa précision −40 % sur 4 matchs (sonnés deux fois plus) (≈ 0,5 × 0,08 − 0,5 × 0,12 ≈ −0,02 V)
- `glace` · Un match à la fois · Régulier · `{ duree: 1, canaux: { defense: 0.96 } }` · −1 tir contre ce soir (≈ +0,02 V)
**L'issue** : la feuille du duel ; le dé à Hier soir ; le verso de sa carte : « A garanti la victoire contre New Jersey, 52e match : 3 buts » — ce qu'on raconte après.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis, check_gros.

### La ronde de séries (6)

Le moment « ronde » se lit le matin du premier match d'une ronde, sur `f.ronde` **(neuf : `{ k, adv, leurCoach: { nom, ico, pouvoir }, domicile, ficheSaison: { v, d }, precedente: { matchs }, meneur, gardien: { n, cle, pctArr, departs } }`)**. Une `duree` de 7 couvre la série.

### 35. 🎟 Les billets de séries
**Voix** pr · **Moment** ronde (la première) · **Famille** mandat (argent)
**Le fait** : `f => !!f.ronde && f.ronde.k === 1 && !!f.vedette` ; champ `f.ronde` ; joueur `f.vedette`.
**La réplique** : « Les séries. Je peux doubler le prix des billets, les gens paieront pour voir {nom} ; ou je les laisse au prix de la saison et l'aréna sera plein à craquer dès le premier soir. »
**Le fait sous elle** : « Ronde 1 contre Boston · 7e sur 32, 44-30-8 · Lafleur : 14 points en 10 matchs »
**Les options** :
- `prix` · Le prix des séries · Régulier · `{ jetons: 30 }` · +30 🪙 (≈ 0,30 V)
- `plein` · Plein à craquer, au prix régulier · Régulier · `{ gestes: { energieTous: 10 }, xp: 2 }` · toute l'équipe jambes +10, ton coach +2 (≈ 0,30 V)
**L'issue** : la caisse ; les jambes au premier match ; la prime de ronde (40 🪙) s'ajoute si tu passes.
**Le juge** : check_histoires, check_mots, check_effets.

### 36. 🔎 Leur coach
**Voix** dp · **Moment** ronde · **Famille** course (séries)
**Le fait** : `f => !!f.ronde && !!f.ronde.leurCoach && !!f.ronde.gardien` ; champ `f.ronde.leurCoach` (`persoAdverse`, son seul pouvoir) ; joueur ton gardien partant.
**La réplique** : « Leur banc, c'est {ico} {leurCoach}, et il joue {pouvoir} chaque fois qu'il peut. J'ai la vidéo de leurs vingt derniers matchs. {nom} la regarde avec moi toute la nuit, ou il dort et on lui raconte. »
**Le fait sous elle** : « Ronde 2 contre Edmonton · leur coach : 🐝 le Frelon, la ruée · Roy : ,931 en 5 départs de séries »
**Les options** :
- `video` · La vidéo toute la nuit · Pilier · `{ duree: 7, lui: { arrets: 0.9 }, gestes: { energie: -15 } }` · les buts qu'il accorde −10 % la série, ses jambes −15 (≈ +0,15 − 0,05 ≈ 0,10 V)
- `dort` · Il dort, on lui raconte · Régulier · `{ duree: 7, canaux: { defense: 0.95 } }` · −2 tirs contre par match la série (≈ 0,15 V)
**L'issue** : le suivi sur ses départs de la ronde ; l'écran d'avant-match dit le pouvoir et son ombre.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis, check_gros (leur coach).

### 37. 🎖 La revanche
**Voix** ca · **Moment** ronde · **Famille** vestiaire (rivalité)
**Le fait** : `f => !!f.ronde && f.ronde.ficheSaison.d >= 2 && f.ronde.ficheSaison.d > f.ronde.ficheSaison.v && !!f.vedette` ; champ `f.ronde.ficheSaison` ; joueur `f.vedette`.
**La réplique** : « {adv} nous a battus {d} fois cette saison. Les gars veulent la leur rendre, et ils regardent {nom}. Il parle au vestiaire avant le premier, ou tu fermes la porte aux médias et c'est le coach qui parle. »
**Le fait sous elle** : « Ronde 1 contre Québec · 1-3 contre eux cette saison · Richer : 10 points en 10 matchs »
**Les options** :
- `parle` · {nom} parle au vestiaire · Pilier · `{ pari: { chance: 4/6, gagne: { duree: 7, lui: { lancers: 1.3, finition: 1.2 } }, perd: { duree: 7, lui: { finition: 0.7 } } } }` · 🎲 sur 3 à 6 : ses tirs +30 %, sa précision +20 % la série ; sinon −30 % (≈ 0,67 × 0,25 − 0,33 × 0,2 ≈ +0,10 V)
- `coach` · Le coach ferme le vestiaire · Régulier · `{ xp: 6 }` · ton coach +6 (≈ 0,30 V — à ramener à +4 si le dé pèse moins que 0,1)
**L'issue** : le suivi sur la série ; le verso de sa carte : « A parlé avant la ronde 1 contre Québec : 6 points en 6 matchs ».
**Le juge** : check_histoires, check_mots, check_effets, check_suivis.

### 38. 🩼 Le blessé des séries
**Voix** me · **Moment** ronde · **Famille** blessure
**Le fait** : `f => !!f.ronde && !!f.blesses.find(b => b.m <= 7 && b.m >= 2 && !['commotion','fracture','ligaments'].includes(b.genre))` ; champs `f.blesses`, `genre` ; joueur ce blessé.
**La réplique** : « {nom} a {m} matchs à faire, et la série en a sept au plus. Il peut jouer à l'infiltration dès le premier ; je ne garantis pas le deuxième. Ou il regarde celle-là du haut et il revient entier pour la suivante. »
**Le fait sous elle** : « Ronde 2 contre Détroit · Sakic : une épaule séparée, 4 matchs encore »
**Les options** :
- `infiltration` · Il joue à l'infiltration · Pilier · `{ gestes: { soin: 4 }, duree: 7, lui: { finition: 0.85, blessure: 1.8 } }` · −4 matchs d'infirmerie ; sa précision −15 %, ses blessures +80 % la série (≈ +0,24 − 0,12 ≈ +0,12 V, et le risque de le perdre pour la suite)
- `haut` · Il regarde du haut · Régulier · `{ duree: 14, lui: { blessure: 0.6 } }` · ses blessures −40 % sur 14 matchs à son retour (≈ +0,10 V)
**L'issue** : le suivi dit ses matchs joués dans la ronde et s'il s'est reblessé ; l'infirmerie au filtre 🩹.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis, check_incidents.

### 39. 🦵 Sept matchs dans les jambes
**Voix** ph · **Moment** ronde (la deuxième ou après) · **Famille** blessure (jambes)
**Le fait** : `f => !!f.ronde && f.ronde.k >= 2 && f.ronde.precedente.matchs >= 6 && !!f.pire && f.pire.j < 80` ; champs `f.ronde.precedente`, `f.pire` ; joueur `f.pire`.
**La réplique** : « {matchs} matchs dans la ronde d'avant, et {nom} est à {j}. Deux jours de glace légère et je te le rends ; ou il garde le rythme avec les autres et on verra au cinquième match. »
**Le fait sous elle** : « Ronde 3 contre Boston · la ronde d'avant en 7 · jambes 79 · Robinson : 66 »
**Les options** :
- `legere` · Deux jours de glace légère · Régulier · `{ gestes: { energieTous: 12 } }` · toute l'équipe jambes +12 (≈ 0,24 V)
- `rythme` · Il garde le rythme · Régulier · `{ pari: { chance: 4/6, gagne: { duree: 7, lui: { lancers: 1.3 } }, perd: { duree: 7, lui: { finition: 0.7, blessure: 1.5 } } } }` · 🎲 sur 3 à 6 : ses tirs +30 % la série ; sinon sa précision −30 % et ses blessures +50 % (≈ 0,67 × 0,15 − 0,33 × 0,25 ≈ +0,02 V — l'écart est 0,22, serré ; à peser)
**L'issue** : le suivi sur la série ; les jambes aux Lignes avant le premier match.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis.

### 40. 📺 Le marqueur des séries
**Voix** an · **Moment** ronde (la deuxième ou après) · **Famille** vedette (séries)
**Le fait** : `f => !!f.ronde && f.ronde.k >= 2 && !!f.ronde.meneur` ; champ `f.ronde.meneur` (ton meilleur pointeur des séries jusqu'ici, `{ n, cle, pts, m, vraie }`) ; joueur `f.ronde.meneur`.
**La réplique** : « {nom}, {pts} points en {m} matchs de séries. {vraie(j)}. Le pays entier veut l'entendre entre les matchs ; lui, il voudrait qu'on le laisse jouer. »
**Le fait sous elle** : « Ronde 2 contre Edmonton · Lemieux : 11 points en 6 matchs de séries · cette année-là, 85 buts en 76 matchs »
**Les options** :
- `cameras` · Les caméras le suivent · Régulier · `{ jetons: 20 }` · +20 🪙 (≈ 0,20 V)
- `silence` · Il ne parle à personne avant la Coupe · Pilier · `{ duree: 7, lui: { finition: 1.2, lancers: 1.15 } }` · sa précision +20 %, ses tirs +15 % la série (≈ 0,20 V)
**L'issue** : le suivi sur la série ; le galon 🏵 « Les grands soirs » (5 gros matchs gagnés avec un point) se grave s'il y arrive ; le panthéon.
**Le juge** : check_histoires, check_mots, check_effets, check_suivis, check_galons, check_vie.

---

## 3. Le compte

**Par moment** : lundi 28 (fiches 1-28), gros match 6 (29-34), ronde 6 (35-40). Total 40.

**Par voix** (17, toutes servies) : ca 6 (4, 7, 10, 20, 34, 37) · an 4 (1, 9, 25, 40) · dp 4 (8, 29, 32, 36) · ph 4 (5, 15, 30, 39) · en 3 (2, 3, 12) · pr 3 (6, 21, 35) · me 3 (14, 31, 38) · ad 3 (13, 19, 23) · pt 2 (22, 33) · fi 1 (16) · ag 1 (17) · dg 1 (18) · co 1 (24) · li 1 (28) · pa 1 (26) · ma 1 (27) · eq 1 (11). Aucune voix à laisser partir : chacune a un fait vrai à dire. Si JP veut couper, la plus faible est **le maire** (27 : un fait de club, une fête ; le partisan fidèle dit presque la même ville) — je la garderais pour la couleur, elle est rare.

**Par famille** : blessure 5 (14, 15, 30, 31, 38 ; plus 39 les jambes) · contrat 4 (2, 16, 17, 18) · adjoint 2 (19, 20) · mandat 2 (21, 35) · course 6 (6, 7, 27, 32, 33, 36 ; plus 39) · gardien 4 (3, 12, 22, 30) · vestiaire 9 (4, 10, 20, 23, 24, 28, 29, 34, 37) · recrue 4 (8, 9, 10, 25) · vedette 3 (1, 40 ; 32 la leur) · vétéran 1 (26) · route 2 (5, 13) · chaude 1 (11). Les quatre familles qui manquaient sont couvertes ; les quatre doublées n'ont rien reçu.

**Les rares** (une fois par saison) : 6, 7, 11, 17, 18, 21, 25, 26, 27 — neuf. Les histoires de gros match et de ronde sortent au plus une fois par gros match ou par ronde, et jamais deux fois la même dans une saison (comme `avantDuGros` aujourd'hui).

**Les suites** : 8 → 9 ou 10 (8 matchs, 4 points) ; 23 → 24 (10 matchs, 5 buts du duo). Deux chaînes, trois épisodes 2.

**Ce qui cite la vraie saison** (`f.vraie`) : 1, 2, 8, 17, 18, 25, 26, 29, 32, 40 — dix, toujours du joueur nommé seul.

**Ce que le lundi d'après vérifie** (un suivi par option `lui`/`pari`) : 2, 3, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 28, 30, 34, 36, 37, 38, 39, 40 — vingt-sept histoires engagent un suivi.

**Combien peuvent sortir dans une saison ordinaire** (estimé sur les faits d'aujourd'hui, à mesurer par `mesure_rythme` étendu en C2) : au lundi, ~14 lundis tirés ; avec 28 fiches dont 19 sans borne de calendrier, le pool vrai d'un lundi compte 4 à 8 histoires (la disette, la chicane, la route, le petit, la vedette, une blessure, le gardien battu, un séjour fini presque chaque deux semaines) : les 14 lundis se remplissent, et une saison voit 12 à 14 histoires différentes au lieu de 8,7. Au gros match, 6 à 10 duels par saison, 3 à 5 fiches vraies (l'ancien et la bête noire sont rares, le partant fatigué et la lancée fréquents). À la ronde, une run qui va loin voit 3 à 4 fiches (35 à la ronde 1, 36 et 37 selon l'adversaire, 38 à 40 selon le vestiaire). Le trou de dix matchs tient : le lundi seul ne laisse pas deux semaines vides, et le gros match tombe entre.

**Les champs neufs de faits.js** (à poser en C1, tous lus dans les feuilles jouées ou la cédule connue) : `f.vraie(cle)` (devis), `f.blesses[i].genre` et `.deja`, `f.sejourFini`, `f.mandat`, `f.serie`, `f.jalon`, `f.duo` et `suites[i].butsDuo`, `f.recrue`, `f.veteran`, `f.murEnVue`, `f.coup`, `f.masse.cap`, `f.gros` (`ancien`, `leurVedette`, `monMur`, `lancee`, `malades`, `partant`, `sorte`, `fiche`), `f.ronde` (`leurCoach`, `ficheSaison`, `precedente`, `meneur`, `gardien`). Et `deja` porté sur les trois saisons de la run (aujourd'hui `histoiresSorties` est de la saison).

---

## 4. Ce que JP tranche

1. **La réplique dit un chiffre.** Le devis C dit « la voix dit son nom, son chiffre » ; la règle « une réplique sans chiffre » (`check_clarte` § 5, rogue.md) dit le contraire. Je propose : la réplique peut dire le chiffre du fait (le même que la ligne sous elle, jamais une stat du moteur), et `check_clarte` § 5 se réécrit ainsi.
2. **Les voix changent de main** : le petit au dépisteur (8), le dos-à-dos à ton adjoint (13). Oui, ou l'entraîneur garde ses cinq ?
3. **Un geste neuf, `echange: 'lui'`** (18, la date limite) : le joueur nommé part, `offres` joueurs de son époque, un signé. Sans lui, la famille contrat n'a que l'argent contre le joueur ; avec lui, l'histoire qu'on raconte. Oui, ou 18 devient « garder contre dé » sans échange ?
4. **Les canaux du club au gros match et à la ronde** (29, 32, 33, 34, 36 : `canaux` avec `duree: 1` ou 7). Aujourd'hui `check_histoires` interdit tout effet d'équipe à une histoire ; les avant-matchs en vivaient. Permis pour ces deux moments seuls, bornés par `check_effets` ?
5. **La vraie saison d'un gardien** : `f.vraie` du devis n'a que buts, passes, gp. Ajouter `victoires` et `arrets` pour 3, 12, 22, 30, 36 ? Sinon ces fiches ne citent pas la vraie saison.
6. **Le maire** (27) : garder, ou laisser partir la voix (la seule qui parle sans vrai joueur à elle) ?
7. **Les rares à neuf** : trop pour une saison de 14 lundis (la moitié des lundis d'après le 41e match seraient des rares) ? Je garderais rares 11, 17, 18, 25, 26, 27 et je laisserais 6, 7, 21 revenir sur un autre joueur (SORTIES_MAX).
8. **Le vétéran par l'âge** (26 : 35 ans dans sa saison, `ageAtSeason`) ou par ses saisons chez toi (le cartable, `graverLaSaison`) ? L'âge existe partout ; les saisons chez toi racontent la run.
9. **Les niveaux des cartes d'option** : Soutien et Régulier pour presque tout, Pilier pour la carte d'adjoint, les vingt matchs et la série, aucune ★ Étoile ni ★ Phénomène. D'accord, ou une histoire rare mérite une ★ Étoile (la garantie, 34) ?
10. **Le robot** : `lundiDuRobot` pèse aujourd'hui jetons, xp, adjoint et quelques paris. Il doit apprendre `lui` et `gestes` de ces quarante avant que `mesure_rythme` et `check_profondeur` jugent (C2) — c'est dans le devis, je le rappelle parce que trois fiches (19, 9, 18) ne se pèsent qu'avec la carte d'adjoint ou l'échange.

## 5. Ce que JP a tranché (6 nov. 2026)

Les neuf, posées une à une, toutes dans le sens proposé :
1. **La réplique dit le chiffre du fait** — le même que la ligne sous elle, jamais une stat du moteur ; `check_clarte` § 5 se réécrit ainsi (la règle « une réplique sans chiffre » de rogue.md devient « jamais un chiffre du moteur »).
2. **Les voix changent de main** : le petit au dépisteur, le dos-à-dos à ton adjoint.
3. **Le geste neuf `echange: 'lui'`** pour la date limite des échanges.
4. **Les canaux du club permis au gros match et à la ronde seulement**, bornés par `check_effets` ; jamais au lundi.
5. **La vraie saison d'un gardien** gagne ses victoires et son % d'arrêts.
6. **Le maire reste**, en rare.
7. **Six rares** (11, 17, 18, 25, 26, 27) ; la course perdue (6), la première place (7) et le mandat (21) suivent `SORTIES_MAX` sur un autre joueur.
8. **Le vétéran par l'âge** (35 ans dans sa saison).
9. **Rien au-dessus de Pilier.**

C1 les code.

