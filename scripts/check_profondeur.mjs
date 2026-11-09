/**
 * LA PROFONDEUR DU ROGUE, EN ACTES (V27, tranche 1 ; docs/refonte-v27.md § 5, § 10) — le juge neuf.
 *
 * Une run est une saison en quatre actes (scripts/lib/rogue_actes.mjs). Sur `GRAINES` graines de la vraie première run,
 * les mêmes dés pour chaque robot (`ROBOTS`) : l'attentif, « premier », le naïf, le glouton, et les variantes (placé,
 * courbe, prudent). La décision 5 (JP) : la première Coupe à la run 3 ou plus tard, et pas plus d'une chance sur
 * ≈ 15 % à la run 1. Les runs sont indépendantes (aucune méta de force) : une chance `q` par run donne une première Coupe
 * médiane au premier `k` où 1 − (1 − q)^k ≥ 0,5.
 *
 * LES BORNES (§ 10), chacune un intervalle sur 64 graines, ramené au nombre de graines jouées :
 *   - l'attentif gagne la Coupe 6 à 10 fois sur 64 ; « premier » et le naïf au plus 2 ; le glouton au plus 32 ;
 *   - l'attentif fait 5 à 9 victoires de plus que « premier » et que le naïf, en paires, et au moins deux fois leurs
 *     rondes de séries ;
 *   - la première Coupe médiane de l'attentif à la run 3 ou plus tard, sa chance à la run 1 au plus 10 sur 64 (≈ 15 %) ;
 *   - les cœurs comptent : l'attentif en perd au moins un dans 19 à 38 runs sur 64, en meurt avant l'acte III dans au
 *     plus 8, rate les séries dans au plus 21 ;
 *   - la courbe, en points au classement par acte (pas en `teamStrength`, aveugle aux greffes) : la part de points de
 *     l'attentif monte d'un acte à l'autre, en médiane des paires d'actes de chaque run, de plus de 0 et d'au plus 0,15.
 * Les invariants (la cédule après les échanges, un rival par acte au bon rang, une élite au plus par acte, les cœurs
 * recomptés, le renfort de l'exemple du § 4.4) se jugent à chaque essai ; les bornes, seulement sur 64 graines ou plus :
 * sur un essai court, elles s'impriment sans se juger (deux graines ne prouvent rien).
 *
 * Ce qui est parti (V27, tranche 1) : « mener une vraie équipe » sur quatre saisons, les campagnes de douze runs, la
 * première Coupe deux runs avant celle du robot d'avant (`AVANCE_RUNS`), la Coupe regagnée après la première (`APRES`)
 * et le distrait. Les campagnes lourdes ne tournent jamais sur le PC de JP : en CI, .github/workflows/profondeur.yml.
 *
 *   node scripts/check_profondeur.mjs                         64 graines, tous les robots (une heure et demie à un fil)
 *   GRAINES=2 FILS=1 node --max-old-space-size=2048 scripts/check_profondeur.mjs     l'essai court (quatre minutes)
 *   ROBOTS=attentif,naif SORTIE=runs.json                     seulement ces robots, et leurs runs gardées
 *   LIRE=dossier                                              juge les runs gardées (chaque .json du dossier), sans jouer
 */
import fs from 'node:fs';
import path from 'node:path';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { availableParallelism } from 'node:os';
import { jouerLaRun, ROBOTS, COEURS, ACTES } from './lib/rogue_actes.mjs';
import { renfortDe } from '../js/actes.js';
import { exiger, informer, verdict } from './verdict.mjs';

if (!isMainThread) {
  parentPort.on('message', t => parentPort.postMessage(jouerLaRun(t.robot, t.graine)));
} else {
  const t0 = Date.now();
  const GRAINES = Number(process.env.GRAINES ?? 64);
  const SUR = 64;   // la taille des bornes du § 10
  const v1 = x => x.toFixed(1).replace('.', ',');
  const v2 = x => x.toFixed(2).replace('.', ',');
  const signe = x => `${x >= 0 ? '+' : '−'}${v1(Math.abs(x))}`;
  const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const med = a => { const s = a.slice().sort((x, y) => x - y); return !s.length ? NaN : s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

  let runs;
  if (process.env.LIRE) {
    const dir = process.env.LIRE, vus = new Map();
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) vus.set(`${r.robot}|${r.graine}`, r);
    runs = [...vus.values()];
    console.log(`\n  La profondeur du Rogue, en actes : ${runs.length} runs lues dans ${dir}\n`);
  } else {
    const robots = (process.env.ROBOTS || Object.keys(ROBOTS).join(',')).split(',').filter(Boolean);
    for (const r of robots) if (!ROBOTS[r]) throw new Error(`robot inconnu : ${r} (${Object.keys(ROBOTS).join(', ')})`);
    const FILS = Math.max(1, Number(process.env.FILS) || Math.min(4, availableParallelism() - 1));
    console.log(`\n  La profondeur du Rogue, en actes : ${robots.join(', ')} · ${GRAINES} graines · ${FILS} fils\n`);
    // Les robots qui lisent le moteur d'abord (les plus longs), pour que les fils finissent ensemble.
    const taches = robots.flatMap(robot => Array.from({ length: GRAINES }, (_, g) => ({ robot, graine: `profondeur-${g}` })))
      .sort((a, b) => (ROBOTS[b.robot].politique === 'attentif') - (ROBOTS[a.robot].politique === 'attentif'));
    runs = [];
    let suivante = 0;
    await Promise.all(Array.from({ length: Math.min(FILS, taches.length) }, () => new Promise((resolve, reject) => {
      const w = new Worker(fileURLToPath(import.meta.url));
      const donner = () => { if (suivante < taches.length) w.postMessage(taches[suivante++]); else w.terminate().then(resolve); };
      w.on('message', r => { runs.push(r); donner(); });
      w.once('error', reject);
      donner();
    })));
    if (process.env.SORTIE) fs.writeFileSync(process.env.SORTIE, JSON.stringify(runs));
  }
  const de = robot => runs.filter(r => r.robot === robot).sort((a, b) => a.graine.localeCompare(b.graine, 'fr', { numeric: true }));
  const presents = Object.keys(ROBOTS).filter(r => de(r).length);
  const nGraines = Math.max(0, ...presents.map(r => de(r).length));
  // Les bornes statistiques ne se jugent que sur 64 graines ou plus.
  const JUGE = nGraines >= SUR;
  const juger = (nom, ok, detail) => (JUGE ? exiger(nom, ok, detail) : informer(`${nom} — essai de ${nGraines} graine(s), non jugé`, detail));
  const sur64 = (k, n) => `${k} sur ${n}${n !== SUR ? ` (${v1((SUR * k) / Math.max(1, n))} sur 64)` : ''}`;
  const dans = (k, n, lo, hi) => k >= (lo * n) / SUR && k <= (hi * n) / SUR;
  const paires = (a, b) => { const B = new Map(de(b).map(r => [r.graine, r])); return de(a).filter(r => B.has(r.graine)).map(r => [r, B.get(r.graine)]); };

  /* LES INVARIANTS, à chaque essai. */
  exiger('le renfort de l\'exemple du § 4.4 (Boston aux matchs 5, 33 et 70)', renfortDe([4, 32, 69], [59, 39, 69]) === 2 && renfortDe([4, 32, 69], [19, 39, 69]) === 1 && renfortDe([4, 32, 69], [4, 32, 69]) === 0,
    `5 → 60 et 33 → 40 : ${renfortDe([4, 32, 69], [59, 39, 69])} étapes (2) ; puis 60 → 20 : ${renfortDe([4, 32, 69], [19, 39, 69])} (1)`);
  const cedule = runs.filter(r => r.verif.doubles || r.verif.min !== 82 || r.verif.max !== 82 || r.verif.joursToi !== 82);
  exiger('après chaque échange, 82 matchs à chaque club et jamais deux le même jour', !cedule.length, cedule.length ? cedule.slice(0, 4).map(r => `${r.robot} ${r.graine} ${JSON.stringify(r.verif)}`).join(' · ') : `${runs.length} runs`);
  const sansRival = runs.filter(r => r.rivaux.length !== ACTES.length || r.rivaux.some(x => Math.abs(x.rang - x.voulu) > 1));
  exiger('un rival à la fin de chaque acte, au rang de force voulu (± 1), jamais manquant', !sansRival.length,
    sansRival.length ? sansRival.slice(0, 4).map(r => `${r.robot} ${r.graine} ${JSON.stringify(r.rivaux)}`).join(' · ') : `${runs.length} runs · au rang exact : ${runs.filter(r => r.rivaux.every(x => x.rang === x.voulu)).length}`);
  const sansDuel = runs.filter(r => r.actes.some(a => !a.duel) || r.elites.some(e => !e.duel));
  exiger('chaque rival et chaque élite prise se jouent en duel', !sansDuel.length, sansDuel.length ? sansDuel.slice(0, 4).map(r => `${r.robot} ${r.graine}`).join(' · ') : `${runs.length * ACTES.length} rivaux, ${runs.reduce((a, r) => a + r.elites.length, 0)} élites`);
  const tropDElites = runs.filter(r => [1, 2, 3].some(a => r.elites.filter(e => e.acte === a).length > 1));
  exiger('au plus une élite par acte', !tropDElites.length, tropDElites.length ? tropDElites.slice(0, 4).map(r => `${r.robot} ${r.graine}`).join(' · ') : `${runs.reduce((a, r) => a + r.elites.length, 0)} élites prises`);
  // Une run vivante a perdu exactement un cœur par contrôle raté des actes I et II et par élite perdue ; aucun pour un rival.
  const malComptes = runs.filter(r => !r.mort && r.coeurs !== COEURS - r.actes.slice(0, 2).filter(a => a.tenu === false).length - r.elites.filter(e => e.gagnee === false).length);
  exiger('les cœurs recomptés : un par contrôle raté et par élite perdue, aucun pour un rival', !malComptes.length, malComptes.length ? malComptes.slice(0, 4).map(r => `${r.robot} ${r.graine}`).join(' · ') : `${runs.filter(r => !r.mort).length} runs vivantes`);
  const coupesMortes = runs.filter(r => r.coupe && (r.mort || r.rate));
  exiger('aucune Coupe pour une run morte ou qui a raté l\'acte III', !coupesMortes.length, `${coupesMortes.length}`);

  /* CE QUE CHAQUE ROBOT A FAIT. */
  const coupes = robot => de(robot).filter(r => r.coupe).length;
  for (const robot of presents) {
    const rs = de(robot);
    const morts = [1, 2, 3].map(a => rs.filter(r => r.mort === a).length);
    const elites = rs.flatMap(r => r.elites);
    informer(`${robot} (${rs.length} runs, ${v1(moy(rs.map(r => r.s)))} s la run)`,
      `${coupes(robot)} Coupe(s) · ${v1(moy(rs.map(r => r.W)))} V · ${med(rs.map(r => r.rang))}e en médiane · ${v2(moy(rs.map(r => r.rondes)))} rondes · cœurs 2/1/0 : ${[2, 1, 0].map(k => rs.filter(r => r.coeurs === k).length).join('/')} · morts aux actes I/II/III : ${morts.join('/')} · séries ratées : ${rs.filter(r => r.rate).length}`);
    informer(`${robot} : la boutique et les élites`, `${v1(moy(rs.map(r => r.achats)))} packs par saison (cible de l'attentif : 7 à 10) · ${v1(moy(rs.map(r => r.pieces || 0)))} pièces · ${v1(moy(rs.map(r => r.signes)))} signés · ${Math.round(moy(rs.map(r => r.jetonsMax)))} 🪙 au plus riche · packs par nœud ${[0, 1, 2, 3, 4, 5, 6].map(k => v1(moy(rs.map(r => r.noeuds[k] || 0)))).join(' · ')} · élites ${elites.length} prises, ${elites.filter(e => e.gagnee).length} gagnées, ${Math.round(moy(elites.map(e => e.J)))} 🪙 en moyenne`);
  }

  /* LA CIBLE DE LA TRANCHE 1 (§ 5) ET LA PREMIÈRE COUPE (décision 5). */
  const A = de('attentif');
  if (A.length) {
    const n = A.length, k = coupes('attentif'), q = k / n;
    juger('l\'attentif gagne la Coupe 6 à 10 fois sur 64', dans(k, n, 6, 10), sur64(k, n));
    const mediane = q > 0 ? Math.ceil(Math.log(0.5) / Math.log(1 - q) - 1e-9) : Infinity;
    juger('la première Coupe de l\'attentif à la run 3 ou plus tard (médiane, runs indépendantes)', mediane >= 3, `${Number.isFinite(mediane) ? `run ${mediane}` : 'jamais'} (${Math.round(100 * q)} % par run ; entre la run 5 et la run 8 à 6-10 sur 64)`);
    juger('la chance de Coupe de l\'attentif à la run 1 au plus ≈ 15 % (10 sur 64)', dans(k, n, 0, 10), `${Math.round(100 * q)} %`);
    const perdu = A.filter(r => r.coeurs < COEURS).length, mortsAvant = A.filter(r => r.mort === 1 || r.mort === 2).length, sansSeries = A.filter(r => r.mort || r.rate).length;
    juger('l\'attentif perd au moins un cœur dans 19 à 38 runs sur 64', dans(perdu, n, 19, 38), sur64(perdu, n));
    juger('l\'attentif meurt de ses cœurs avant l\'acte III dans au plus 8 runs sur 64', dans(mortsAvant, n, 0, 8), sur64(mortsAvant, n));
    juger('l\'attentif rate les séries dans au plus 21 runs sur 64', dans(sansSeries, n, 0, 21), sur64(sansSeries, n));
    // LA COURBE, en points au classement par acte : la part de points (pts sur deux par match) d'un acte au suivant.
    const part = (r, a) => r.actes[a].pts / (2 * r.actes[a].matchs);
    informer('la courbe de l\'attentif : sa part de points par acte, en médiane', [0, 1, 2].map(a => v2(med(A.map(r => part(r, a))))).join(' · '));
    for (const a of [1, 2]) {
      const d = med(A.map(r => part(r, a) - part(r, a - 1)));
      juger(`la part de points de l'attentif monte de l'acte ${['I', 'II'][a - 1]} à l'acte ${['II', 'III'][a - 1]} (médiane des paires, dans ]0 ; 0,15])`, d > 0 && d <= 0.15, `${d >= 0 ? '+' : '−'}${v2(Math.abs(d))}`);
    }
  }
  for (const autre of ['premier', 'naif']) {
    if (!de(autre).length) continue;
    const n = de(autre).length, k = coupes(autre);
    juger(`« ${autre} » gagne la Coupe au plus 2 fois sur 64`, dans(k, n, 0, 2), sur64(k, n));
    const p = paires('attentif', autre);
    if (!p.length) continue;
    const dW = moy(p.map(([a, b]) => a.W - b.W));
    juger(`l'attentif fait 5 à 9 victoires de plus que « ${autre} », en paires`, dW >= 5 && dW <= 9, `${signe(dW)} V (${p.length} paires)`);
    const ra = moy(p.map(([a]) => a.rondes)), rb = moy(p.map(([, b]) => b.rondes));
    juger(`l'attentif gagne au moins deux fois plus de rondes de séries que « ${autre} »`, ra > 0 && ra >= 2 * rb, `${v2(ra)} contre ${v2(rb)} par run`);
  }
  if (de('glouton').length) {
    const n = de('glouton').length, k = coupes('glouton');
    juger('le glouton (chaque élite, même au dernier cœur) gagne la Coupe au plus 32 fois sur 64', dans(k, n, 0, 32), sur64(k, n));
  }

  /* LES VARIANTES, lues en paires contre l'attentif ; leurs juges sont ceux de leur tranche (§ 10). */
  const contre = (variante, quoi) => {
    const p = paires(variante, 'attentif');
    if (!p.length) return;
    const dW = p.map(([a, b]) => a.W - b.W);
    informer(`${variante} contre l'attentif (${quoi})`, `${signe(moy(dW))} V en paires · mieux dans ${dW.filter(x => x > 0).length} graines sur ${p.length} · Coupes ${p.filter(([a]) => a.coupe).length} contre ${p.filter(([, b]) => b.coupe).length} · morts ${p.filter(([a]) => a.mort).length} contre ${p.filter(([, b]) => b.mort).length}${variante === 'place' ? ` · ${v1(moy(p.map(([a]) => a.renfort)))} étapes de renfort` : ''}`);
  };
  contre('place', 'le calendrier placé, jugé à la tranche 4 : −1 à +1 V, aide une graine sur quatre');
  contre('courbe', '*ETAPES_DES_ACTES* [0, 1, 2] contre [0, 0, 0] : la mesure tranche');
  contre('prudent', 'les élites refusées, jugé à la tranche 7 : prendre gagne au moins autant de Coupes');
  if (!JUGE) informer('l\'essai court', `${nGraines} graine(s) ne prouvent rien : les bornes se jugent sur 64 graines, en CI (.github/workflows/profondeur.yml)`);
  const total = runs.reduce((a, r) => a + r.s, 0);
  informer('le temps', `${((Date.now() - t0) / 1000).toFixed(0)} s · ${total} s de runs (${presents.map(r => `${r} ${v1(moy(de(r).map(x => x.s)))} s`).join(', ')}) · à 64 graines sur quatre fils : ≈ ${Math.round((total / Math.max(1, nGraines)) * SUR / 4 / 60)} min`);
  verdict('La profondeur du Rogue, en actes');
}
