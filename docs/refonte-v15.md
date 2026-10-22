# V15 — Les styles naissent des badges

JP, 22 oct. 2026 :
- *Le système de stratégie de ligne est débile, je pense qu'on doit faire plus un système que les badges des joueurs influencent certains styles de trio possibles.*
- *Genre, plus de badges par joueur, plus de possibilités, qui jouent sur le trio un peu, plus de counter, ou tous les trios peuvent tout faire.*
- *Ça force à bâtir les stratégies à partir des cartes.*
- Puis, devant la première maquette : *l'idée est de rendre l'interface et tout plus clean et simple*.

La maquette épurée : https://claude.ai/artifact/XRDNETj2KHK8J7G8YCUNqp.

## Les règles (Rogue seulement ; le 82-0 ne bouge pas)

- **Un style s'ouvre par des badges.** Chaque système d'une unité dit ce qu'il veut (`veut`, js/sim.js), en un ou deux groupes ; un groupe se remplit par un des rôles qu'il nomme, en premier ou en second badge, chez n'importe quel joueur de l'unité. Le Hourra reste toujours ouvert.
  - Trios :
    - 🌧 Volume de tirs : 🎯 Sniper ;
    - 🌀 Cycle : 🅰 Passeur ;
    - 🧲 Enclave : 🦍 Power ;
    - 🪤 Trappe : ☯ Deux sens ;
    - 🔥 Échec avant : 🔧 Checker ou 🪠 Plombier ;
    - 🧰 Plombiers : 🪠 Plombier ou 👊 Bagarreur ;
    - 🏹 Contre-attaque : 🎯 Sniper **et** 🅰 Passeur.
  - Paires :
    - 🏠 Rester à la maison : 🛑 Défensif ;
    - 🛫 Activer : 🚀 Offensif ;
    - 💨 Sortie rapide : 🏒 Manieur ;
    - 🧹 Nettoyer l'enclave : 💪 Physique ;
    - 🌗 Deux sens : ☯ Deux sens.
- **Les métaux font la force.** Le gain d'un style suit le fit des badges que ses cases demandent (`fitUnite`, `fitDeCase`), la lecture du 82-0 : rien sous 30, tout à 75, un quart de plus au-delà. Son prix se paie toujours.
- **Les contres restent.** C'est le cycle des styles (`bat`) : chaque style en étouffe un autre et l'est par un. Les styles que tes badges ouvrent décident qui tu peux contrer ; l'écran le dit d'un mot, « Contre leur trio ».
- **Les cartes font les badges.** Plus tes joueurs portent de badges, plus leurs unités ont de styles. Les éditions, les galons et l'atelier montent leurs métaux.
- **Le plan part.** Les familles qu'un système payait, le coach qui les comptait (`PLAN_PAIE`, `COACH_DU_PLAN`, `systemeDuPlan`), et à l'écran « bâti pour / assorti / mal assorti », le conseil « irait mieux en… » et la ligne « Plan » du coach. Les familles restent pour ranger les packs et le profil, et pour l'intention que l'adversaire prête à ton coach au duel.

## L'écran

- **Effectif › Lignes** (le tiroir d'une unité) : seuls les styles ouverts, en boutons. Le choisi se dit en une ligne de vraies stats ; les fermés se plient (« 3 styles fermés »), chacun avec le badge qui lui manque.
- **Le tableau du duel** n'offre à chaque unité que ses styles ouverts.
- **Une ligne qu'on ne règle pas**, ou un style fermé gardé dans une vieille sauvegarde, joue le meilleur style ouvert (`meilleurStyle`, `lignesDe`).

## Les juges

- `check_styles` (nouveau, une seconde) :
  - chaque style veut des badges que ses cases demandent, et le cycle tient ;
  - sur 632 trios de 158 vrais clubs, un trio ouvre 4,0 styles sur 7 en moyenne, aucun jamais, tous 1 % du temps ;
  - plus de badges différents dans un trio, plus de styles : 2,6 avec deux badges, 5,6 avec cinq ;
  - en Rogue, un style fermé joue le meilleur ouvert ; au 82-0, rien ne change.
- `check_fit` part avec le plan qu'il jugeait.
- `check_coachs` perd ses deux tests du plan.
- `check_profondeur` (huit campagnes) : l'attentif bat le robot d'avant de +5,7 V, gagne sa première Coupe à la run 7 en médiane, puis la regagne 34 % du temps, une fois 🔺 la ceinture ramenée de 3 à 2 M$.
- `check_duel` : 63,1 % en face à face.
- `VERSION_MOTEUR` passe à S118 : une saison de Rogue en cours se rejoue. L'empreinte du 82-0 ne bouge pas.
