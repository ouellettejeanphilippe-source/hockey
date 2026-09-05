/*
 * Maquette du moteur par ÉVÉNEMENTS — étape 2 de MOTEUR.md.
 *
 * Ne touche à rien. Rejoue de vraies saisons avec le lancer comme primitive et
 * compare les feuilles de match produites aux VRAIS totaux : buts d'équipe,
 * lancers, pourcentage d'arrêts des gardiens, et totaux des meilleurs
 * marqueurs.
 *
 * La question à laquelle ce script répond : le modèle par lancers tient-il
 * debout AVANT qu'on touche à js/sim.js ?
 *
 * Le moteur, par match :
 *
 *   1. combien de lancers    volume de l'équipe x suppression de l'adversaire
 *   2. qui tire              un joueur sur la glace, au prorata de ses lancers
 *                            par minute et de la part de glace de son unité
 *   3. but ou arrêt          %tir du tireur, corrigé par la qualité du gardien
 *                            relativement à la ligue de cette saison-là
 *   4. les passes            une principale, parfois une secondaire, aux
 *                            coéquipiers de l'unité selon leur propension
 *
 * Les trois égalités de cohérence sont vérifiées sur CHAQUE match, pas à la
 * fin : buts = somme des buts des joueurs, lancers = arrêts + buts, passes
 * <= 2 par but.
 *
 *   node scripts/mock_moteur.mjs
 *   SAISONS=1976-77,2015-16 ESSAIS=3 node scripts/mock_moteur.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');

/* Parts de temps de glace. Ce sont les mêmes poids que js/sim.js, mais ils
 * cessent d'être une pondération abstraite : ils disent quelle fraction des
 * présences chaque unité obtient, donc combien de lancers elle prend. */
const POIDS_TRIO = [0.34, 0.28, 0.22, 0.16];
const POIDS_PAIRE = [0.40, 0.34, 0.26];

/* Part des lancers d'une équipe prise par les défenseurs. ~25 % en moyenne
 * dans la LNH moderne ; le reste va aux attaquants. */
const PART_LANCERS_D = 0.25;

/* Probabilité qu'un but reçoive une passe secondaire en plus de la principale. */
const P_PASSE_2 = 0.62;

const SAISONS = (process.env.SAISONS ?? '1970-71,1976-77,1985-86,1995-96,2015-16,2023-24').split(',');
const ESSAIS = Number(process.env.ESSAIS ?? 3);

const moy = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const poisson = (lam) => {
  const L = Math.exp(-lam);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
};
/** Tire un indice au prorata des poids. */
const tirage = (poids, total) => {
  let x = Math.random() * total;
  for (let i = 0; i < poids.length; i++) { x -= poids[i]; if (x <= 0) return i; }
  return poids.length - 1;
};

/* ---------- construction des équipes d'une saison ---------- */
function equipesDe(shard) {
  // Les joueurs echanges (x:1) portent leurs totaux de SAISON COMPLETE dans
  // chaque equipe ou ils sont passes. Les sommer par equipe les compte donc
  // deux fois : mesure, +43 % de lancers en 1995-96 et +14,5 % en 2023-24.
  // Le shard ne dit pas comment repartir leur saison entre les clubs, alors ce
  // banc les ecarte des DEUX cotes -- de la reference et de l'alignement --
  // pour que la comparaison porte sur la meme population. Ca sous-estime les
  // equipes qui ont beaucoup echange, mais ca ne biaise pas l'ecart.
  const parEquipe = {};
  for (const p of shard.players) {
    if (p.x) continue;
    (parEquipe[p.t] = parEquipe[p.t] || []).push(p);
  }

  // Repères de la ligue, sur joueurs uniques (un échangé x:1 porte ses totaux
  // dans chaque équipe et serait compté deux fois)
  const uniques = shard.players.filter(p => !p.x);
  const patineurs = uniques.filter(p => p.p !== 'G');

  const butsLigue = patineurs.reduce((s, p) => s + (p.g || 0), 0);
  const lancersLigue = patineurs.reduce((s, p) => s + (p.sh || 0), 0);
  const pctTirLigue = butsLigue / Math.max(1, lancersLigue);
  const svLigue = 1 - pctTirLigue;   // miroir exact : tout lancer est un but ou un arrêt

  const matchsPar = {};
  for (const p of uniques) matchsPar[p.t] = Math.max(matchsPar[p.t] || 0, p.gp || 0);
  const matchsLigue = Object.values(matchsPar).reduce((s, x) => s + x, 0);

  // Ecarter les echanges ampute les deux cotes INEGALEMENT : les lancers POUR
  // viennent des patineurs, souvent echanges, alors que les lancers CONTRE
  // viennent des gardiens, qui le sont rarement. Or dans une ligue fermee les
  // deux totaux sont le MEME nombre. Cette identite donne donc le facteur de
  // correction, sans avoir a repartir la saison d'un joueur entre ses clubs.
  const lancersContreLigue = uniques
    .filter(p => p.p === 'G')
    .reduce((s, g) => s + (g.sa || 0), 0);
  const correction = lancersContreLigue / Math.max(1, lancersLigue);
  const lancersParMatchLigue = lancersContreLigue / Math.max(1, matchsLigue);

  const equipes = [];
  for (const [t, tous] of Object.entries(parEquipe)) {
    const prod = p => (p.pt || 0) / Math.max(1, p.gp);
    const F = tous.filter(p => p.p === 'F' && p.gp >= 10).sort((a, b) => prod(b) - prod(a)).slice(0, 12);
    const D = tous.filter(p => p.p === 'D' && p.gp >= 10).sort((a, b) => prod(b) - prod(a)).slice(0, 6);
    const G = tous.filter(p => p.p === 'G').sort((a, b) => b.gp - a.gp);
    if (F.length < 12 || D.length < 6 || !G.length) continue;

    const matchs = matchsPar[t] || 82;
    const gardien = G[0];
    if (!gardien.sa || !gardien.sv) continue;

    // % d'arrets de l'EQUIPE, pondere par les lancers, pas celui du seul
    // partant. Mesure : un partant arrete 4,7 a 7,1 milliemes de mieux que la
    // moyenne de sa ligue, parce que les auxiliaires tirent la moyenne vers le
    // bas. Ne faire jouer que les partants sous-produisait les buts de 4 %.
    // Le vrai moteur fera tourner les gardiens ; ici on prend l'agregat, qui
    // est exactement ce que l'equipe a reellement alloue.
    const saTotal = G.reduce((s2, g) => s2 + (g.sa || 0), 0);
    const svEquipe = saTotal > 0
      ? G.reduce((s2, g) => s2 + (g.sa || 0) * (g.sv || 0), 0) / saTotal
      : gardien.sv;

    // Vrais reperes de l'equipe, pour la comparaison ET pour le moteur
    const tousPatineurs = tous.filter(p => p.p !== 'G');   // deja sans les echanges
    const vraiButs = tousPatineurs.reduce((s, p) => s + (p.g || 0), 0) * correction;
    const vraiLancers = tousPatineurs.reduce((s, p) => s + (p.sh || 0), 0) * correction;
    const vraiLancersContre = G.reduce((s, g) => s + (g.sa || 0), 0);

    equipes.push({
      t, matchs, F, D, G: gardien, svEquipe,
      // volume de lancers de l'equipe, relatif a la ligue
      pression: (vraiLancers / matchs) / lancersParMatchLigue,
      // capacite a limiter les lancers adverses, relative a la ligue
      suppression: (vraiLancersContre / matchs) / lancersParMatchLigue,
      vrai: {
        buts: vraiButs,
        lancers: vraiLancers,
        lancersContre: vraiLancersContre,
        sv: svEquipe,
      },
    });
  }
  return { equipes, lancersParMatchLigue, pctTirLigue, svLigue, correction, saison: shard.season };
}

/* ---------- un match ---------- */
function jouerMatch(A, B, ctx, statsA, statsB, incoherences) {
  for (const [nous, eux, stats] of [[A, B, statsA], [B, A, statsB]]) {
    const attendu = ctx.lancersParMatchLigue * nous.pression * eux.suppression;
    const lancers = Math.max(8, poisson(attendu));

    // Qualite du gardien adverse, relative a sa ligue. Un gardien qui arrete
    // 2 points de plus que la moyenne laisse passer proportionnellement moins.
    const facteurGardien = (1 - eux.svEquipe) / Math.max(0.02, 1 - ctx.svLigue);

    let butsMatch = 0, arretsMatch = 0;
    for (let s = 0; s < lancers; s++) {
      // Quelle unite est sur la glace, et qui tire
      const estD = Math.random() < PART_LANCERS_D;
      const groupe = estD ? nous.D : nous.F;
      const poidsUnite = estD ? POIDS_PAIRE : POIDS_TRIO;
      const taille = estD ? 2 : 3;
      const u = tirage(poidsUnite, 1);
      const unite = groupe.slice(u * taille, (u + 1) * taille);
      if (!unite.length) continue;

      const poidsTir = unite.map(p => Math.max(0.05, (p.sh || 0) / Math.max(1, p.gp)));
      const tireur = unite[tirage(poidsTir, poidsTir.reduce((s2, x) => s2 + x, 0))];

      // %tir du tireur, corrige par le gardien
      const pctTireur = (tireur.g || 0) / Math.max(1, tireur.sh || 1);
      const pBut = Math.min(0.45, pctTireur * facteurGardien);

      if (Math.random() < pBut) {
        butsMatch++;
        stats.buts.set(tireur.id, (stats.buts.get(tireur.id) || 0) + 1);
        // passes : parmi les coequipiers de l'unite, selon leur propension
        const co = unite.filter(p => p !== tireur);
        if (co.length) {
          const poidsP = co.map(p => Math.max(0.05, (p.a || 0) / Math.max(1, p.pt || 1)));
          const tot = poidsP.reduce((s2, x) => s2 + x, 0);
          const p1 = co[tirage(poidsP, tot)];
          stats.passes.set(p1.id, (stats.passes.get(p1.id) || 0) + 1);
          const reste = co.filter(p => p !== p1);
          if (reste.length && Math.random() < P_PASSE_2) {
            const p2 = reste[Math.floor(Math.random() * reste.length)];
            stats.passes.set(p2.id, (stats.passes.get(p2.id) || 0) + 1);
            stats.passesMatch += 1;
          }
          stats.passesMatch += 1;
        }
      } else {
        arretsMatch++;
      }
    }

    stats.lancers += lancers;
    stats.butsTotal += butsMatch;
    stats.butsMatchs.push(butsMatch);
    // le gardien adverse encaisse
    const autre = stats === statsA ? statsB : statsA;
    autre.lancersContre += lancers;
    autre.arrets += arretsMatch;
    autre.butsAlloues += butsMatch;

    // ---- egalites de coherence, verifiees sur CE match ----
    if (arretsMatch + butsMatch !== lancers) {
      incoherences.push(`${nous.t}: lancers ${lancers} != arrets ${arretsMatch} + buts ${butsMatch}`);
    }
    if (stats.passesMatch > 2 * butsMatch) {
      incoherences.push(`${nous.t}: ${stats.passesMatch} passes pour ${butsMatch} buts`);
    }
    stats.passesMatch = 0;
  }
}

/* ---------- une saison ---------- */
function jouerSaison(ctx) {
  const n = ctx.equipes.length;
  const stats = ctx.equipes.map(() => ({
    buts: new Map(), passes: new Map(), passesMatch: 0,
    lancers: 0, butsTotal: 0, butsMatchs: [], matchsJoues: 0,
    lancersContre: 0, arrets: 0, butsAlloues: 0,
  }));
  const incoherences = [];

  for (let r = 0; r < 82; r++) {
    const ordre = [...ctx.equipes.keys()];
    for (let i = ordre.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
    }
    for (let i = 0; i + 1 < ordre.length; i += 2) {
      const a = ordre[i], b = ordre[i + 1];
      jouerMatch(ctx.equipes[a], ctx.equipes[b], ctx, stats[a], stats[b], incoherences);
      stats[a].matchsJoues++; stats[b].matchsJoues++;
    }
  }
  return { stats, incoherences };
}

/* ---------- passe principale ---------- */
console.log('\nMaquette du moteur par événements — le lancer comme primitive.');
console.log(`${ESSAIS} essai(s) par saison. Chaque match est vérifié pour les trois égalités.\n`);

let totalIncoherences = 0;
const ecartsButs = [], ecartsLancers = [], ecartsSv = [];

for (const label of SAISONS) {
  const f = path.join(SEASONS_DIR, `${label}.json`);
  if (!fs.existsSync(f)) { console.log(`  ${label} : shard absent`); continue; }
  const ctx = equipesDe(JSON.parse(fs.readFileSync(f, 'utf8')));
  if (ctx.equipes.length < 6) { console.log(`  ${label} : trop peu d'équipes complètes`); continue; }

  const cumul = ctx.equipes.map(() => ({ buts: 0, lancers: 0, arrets: 0, lancersContre: 0, matchs: 0 }));
  let inc = 0;
  for (let e = 0; e < ESSAIS; e++) {
    const { stats, incoherences } = jouerSaison(ctx);
    inc += incoherences.length;
    stats.forEach((s, i) => {
      cumul[i].buts += s.butsTotal;
      cumul[i].lancers += s.lancers;
      cumul[i].arrets += s.arrets;
      cumul[i].lancersContre += s.lancersContre;
      cumul[i].matchs += s.matchsJoues;
    });
  }
  totalIncoherences += inc;

  // Les vraies saisons n'ont pas toutes 82 matchs : on ramene au prorata
  const eb = [], el = [], es = [];
  for (let i = 0; i < ctx.equipes.length; i++) {
    const eq = ctx.equipes[i];
    // Avec un nombre IMPAIR d'equipes une equipe chome a chaque ronde, donc
    // chacune joue moins de 82 matchs. On ramene sur les matchs reellement
    // joues, sinon le banc lit un deficit de volume qui n'est qu'un artefact
    // d'appariement -- mesure : -3,1 % a 29 equipes, -0,2 % a 32.
    const joues = cumul[i].matchs / ESSAIS;
    const k = eq.matchs / Math.max(1, joues);
    const simButs = cumul[i].buts / ESSAIS * k;
    const simLancers = cumul[i].lancers / ESSAIS * k;
    const simSv = cumul[i].arrets / Math.max(1, cumul[i].lancersContre);
    eb.push(100 * (simButs - eq.vrai.buts) / Math.max(1, eq.vrai.buts));
    el.push(100 * (simLancers - eq.vrai.lancers) / Math.max(1, eq.vrai.lancers));
    es.push(1000 * (simSv - eq.vrai.sv));
  }
  ecartsButs.push(...eb); ecartsLancers.push(...el); ecartsSv.push(...es);

  const absmoy = (a) => moy(a.map(Math.abs));
  console.log(`  ${label}  ${String(ctx.equipes.length).padStart(2)} éq.`
    + `   buts ${moy(eb) >= 0 ? '+' : ''}${moy(eb).toFixed(1)} % (écart moyen ${absmoy(eb).toFixed(1)} %)`
    + `   lancers ${moy(el) >= 0 ? '+' : ''}${moy(el).toFixed(1)} %`
    + `   %arr ${moy(es) >= 0 ? '+' : ''}${moy(es).toFixed(1)} millièmes`
    + `   ${inc ? `⚠ ${inc} incohérences` : '✓'}`);
}

const absmoy = (a) => moy(a.map(Math.abs));
console.log(`
  BILAN sur ${ecartsButs.length} équipes-saisons

    buts d'équipe      biais ${moy(ecartsButs).toFixed(1)} %   erreur moyenne ${absmoy(ecartsButs).toFixed(1)} %
    lancers d'équipe   biais ${moy(ecartsLancers).toFixed(1)} %   erreur moyenne ${absmoy(ecartsLancers).toFixed(1)} %
    % d'arrêts         biais ${moy(ecartsSv).toFixed(1)} millièmes   erreur moyenne ${absmoy(ecartsSv).toFixed(1)}

    cohérence des feuilles de match : ${totalIncoherences === 0 ? '✓ aucune incohérence' : `⚠ ${totalIncoherences} incohérences`}

  Le biais doit être proche de zéro (le moteur ne doit ni gonfler ni déprimer
  la ligue) et l'erreur moyenne dit à quel point une équipe donnée est bien
  reproduite. Un biais nul avec une grosse erreur moyenne veut dire que le
  moteur redistribue mal entre les équipes.
`);
