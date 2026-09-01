# Cap 82-0 — instructions pour l'agent

## Le projet en une phrase

Jeu web statique en français québécois : la roulette sort une saison et une équipe de la LNH, tu piges un joueur dans ce vestiaire, tu bâtis un alignement de 23 sous le plafond salarial, et tu simules 82 matchs.

Hébergé sur GitHub Pages. Aucun backend, aucune dépendance npm, aucun framework.

## Avant de coder

Lis `ARCHITECTURE.md` — il explique pourquoi le découpage se fait par saison et non par équipe. Ce choix n'est pas arbitraire et le défaire casse la normalisation par époque.

Lis `PLAN.md` — il contient l'état exact du projet, ce qui est fait, ce qui reste, et l'ordre de priorité. Coche les cases au fur et à mesure et ajoute une ligne au journal en bas.

## Structure

```
index.html                  page unique
style.css                   tous les styles
js/ratings.js               calcul des cotes cachées (partagé navigateur + build)
js/data.js                  chargeur trois niveaux + cache IndexedDB
js/sim.js                   structure de l'alignement + simulation de saison
js/game.js                  contrôleur d'interface
scripts/build_shards.py     aspire l'API LNH, écrit les shards
scripts/rate.mjs            pont Node vers js/ratings.js
data/index.json             liste des saisons disponibles
data/seasons/<saison>.json  un shard par saison
data/seed.json              filet hors ligne
```

## Règles fermes

**Une seule implémentation des cotes.** `js/ratings.js` est la source unique. Le navigateur l'importe, et `scripts/build_shards.py` y accède via `scripts/rate.mjs`. Ne réimplémente jamais la formule en Python — ça produirait deux définitions qui divergent silencieusement.

**Toucher à une formule de cote veut dire incrémenter `RATINGS_VERSION`** dans `js/ratings.js`. La version est dans la clé du cache IndexedDB. Sans incrément, un joueur se retrouve avec des cotes calculées par deux formules différentes dans le même alignement.

**Modules ES natifs, pas de build step.** `<script type="module">`. Aucun bundler, aucun transpileur, aucun `node_modules`. Le dépôt doit pouvoir être servi tel quel.

**Français québécois** dans toute l'interface et tous les commentaires. Abréviations de hockey en français : PJ, B, A, PTS, PUN, V, D, BL, MBA (moyenne de buts alloués), AG/C/AD, DG/DD.

**Mobile d'abord.** Cible 390 px de large. Teste à cette largeur avant de déclarer une tâche terminée.

**Pas de localStorage pour les données de saison** — trop petit. IndexedDB, comme dans `js/data.js`.

## Recalibrer la simulation

Les constantes de `js/sim.js` sont calibrées. Repères actuels, 23 joueurs de cote uniforme, moyenne sur 12 essais :

| Cote | Fiche |
|---|---|
| 50 | 24-53-5 |
| 60 | 47-31-5 |
| 70 | 67-13-1 |
| 80 | 76-6-0 |
| 90 | 80-2-0 |
| 99 | 81-1-0 |

Si tu changes `POIDS_TRIO`, `POIDS_PAIRE`, les exposants de `xGF`/`xGA` ou la courbe du clutch, tu dois refaire tourner ce tableau et le mettre à jour ici et dans `PLAN.md`. La cible : une équipe parfaite perd quand même environ un match en moyenne. Le 82-0 doit rester rare, sinon le jeu n'a pas d'enjeu.

Bout de code pour recalibrer, à coller dans la console du navigateur :

```js
for (const r of [50,60,70,80,90,99]) {
  const roster = {};
  cap82.G.roster = roster;
  for (const s of (await import('./js/sim.js')).SLOTS) {
    roster[s.i] = { n:'X', p: s.group==='G' ? 'G' : (s.group==='ANY'?'F':s.group),
                    o:r, d:r, r:r, c:r, v:r, $:1e6 };
  }
  let t = [0,0,0];
  for (let i=0;i<12;i++) { const x = cap82.simulate(roster); t[0]+=x.W; t[1]+=x.L; t[2]+=x.OTL; }
  console.log(r, t.map(v=>(v/12).toFixed(1)).join('-'));
}
```

## Tester

Sert la page — `python3 -m http.server 8000` — et ouvre `localhost:8000`. Les modules ES ne fonctionnent pas en `file://`.

S'il y a un runner de navigateur disponible (Playwright), le test de fumée à faire passer :

1. La page démarre, `#game` devient visible
2. Auto-draft : cliquer le premier `.card .add:not([disabled])` en boucle jusqu'à 23/23, en utilisant les rerolls quand le bassin ne contient rien de plaçable
3. `#mainBtn` devient actif
4. Cliquer : `.result .score` affiche une fiche, `.rrow` en compte 23
5. Zéro erreur console

## Ce qu'il ne faut pas faire

- Ne scrape pas hockey-reference ni hockeydb. Leurs conditions l'interdisent. L'API de la LNH est publique et couvre 1917 à aujourd'hui.
- N'ajoute pas de dépendance npm sans une bonne raison écrite dans `PLAN.md`.
- Ne commite pas `data/seasons/*.json` à la main — c'est le job du script et de l'Action.
- Ne mets pas les cotes cachées dans le DOM avant la simulation. Un joueur curieux qui ouvre l'inspecteur ne devrait pas pouvoir les lire. (Actuellement elles sont dans l'objet JS en mémoire — voir PLAN.md tâche J4.)
