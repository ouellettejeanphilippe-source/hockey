/*
 * LE BUILD DÉCIDE — LE TEST D'UN JOUR (V29, tranche 0 ; docs/refonte-v29.md § 4). JP, 13 nov. 2026 : *le roguelike est
 * pas le fun, ni bâti comme il faut pour être un vrai jeu* ; il choisit « le build décide ».
 *
 * La question, avant tout devis de règles : sur le simulateur gardé, sans un geste pendant le match, un banc dont les
 * pièces COMPTENT TES JOUEURS (les paliers d'un badge chez tes habillés, ou d'où vient ton effectif) et multiplient un
 * canal du moteur tout le match, par seuils, sépare-t-il celui qui bâtit de celui qui ne lit pas son banc ? Aujourd'hui :
 * non (les deux robots habiles finissent à la même force, 193 ; « lire paie » a demandé 384 graines).
 *
 * Rien du jeu n'est touché : les pièces d'essai (`ESSAIS`) entrent dans la table `PIECES` le temps de la mesure, hors
 * des voies, à côté des pièces d'aujourd'hui ; les deux robots ne prennent qu'elles, aux mêmes offres (le rival battu,
 * l'élite, le marché), sur les mêmes graines ; la pièce de départ du coach est une pièce d'essai (`DEPART`) et deux
 * autres, tirées de la graine, la suivent dès le camp (`DEPART_N`, JP, 14 nov. 2026 : « trois pièces au camp ») :
 *
 *   le MALIN      le témoin : le robot qui lit d'aujourd'hui (la cote au prix de l'espace, le chemin, le plan du duel), qui
 *                 prend la première pièce d'essai offerte et ne lit pas son banc aux portes ;
 *   le BÂTISSEUR  le même, plus ce que le candidat ajoute à ce que son banc compte (`POIDS` points de cote par point de
 *                 pourcentage), en choisissant aussi qui sort ; la pièce offerte la plus avancée chez lui. Rien d'autre
 *                 ne les sépare ;
 *   le CHIFFRE    (`ROBOTS=chiffre,batisseur`) la meilleure cote, sans rien lire.
 *
 * On juge, à 32 graines ou plus :
 *   — bâtir paie, sans 384 graines : en paires, le bâtisseur tient plus de cibles que le témoin, au-delà de deux écarts-types ;
 *   — le club décolle : à l'acte III, le bâtisseur joue au moins `ECART_III` points de chance au-dessus du témoin ;
 *   — plus d'un build gagne : au moins `BUILDS` pièces d'essai différentes sont la plus forte d'un banc qui tient ses trois cibles.
 * Le reste s'imprime sans se juger (les Coupes, la part des runs à 75 % de chance à l'acte III) : la difficulté se règle
 * après, à sa tranche — avec des pièces qui multiplient, la run d'aujourd'hui devient trop facile, et c'est attendu.
 *
 * MESURÉ LE 14 NOV. 2026, 48 graines, le réglage par défaut (les quatorze pièces, trois au camp, les marches ×1,5) : le
 * bâtisseur 31 Coupes et 79 % de cibles tenues, le témoin 12 et 72 % (+7,6 points en paires, bruit ±10,9 : rouge, les
 * cibles plafonnent) ; l'acte III à 79 % de chance contre 69 % (+9,7 : rouge de peu) ; neuf pièces mènent un banc
 * gagnant. Les huit variantes essayées et ce qu'elles disent : docs/refonte-v29.md § 4.
 *
 *   node scripts/mesure_build.mjs                      les deux robots, `GRAINES` graines (48), `FILS` processus (3)
 *   GRAINES=8 node scripts/mesure_build.mjs            l'essai court : rien ne se juge
 *   POIDS=3.3 FORCE=1 …                                le poids que le bâtisseur donne à son banc ; la force des marches (1,5)
 *   JEU=origines …   JEU=badges …                      une seule sorte de pièces : les cinq d'origine, ou les neuf de badge
 *   DEPART_N=1 …                                       une seule pièce d'essai au camp, celle du coach (3 : deux de plus, tirées de la graine)
 *   SANS=tireurs,passeurs …                            sans quelques pièces d'essai
 * Mesure seulement : jamais lu par le jeu.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SLOTS, badgesDe } from '../js/sim.js';
import { PIECES } from '../js/pieces.js';
import { RUN, chanceCeSoir, prixDe, rebatir } from '../js/run.js';
import { jouerLaRun } from './lib/run_robot.mjs';
import { hache } from '../js/util.js';
import { exiger, informer, verdict } from './verdict.mjs';

const ICI = fileURLToPath(import.meta.url);
const GRAINES = Number(process.env.GRAINES ?? 48);
const FILS = Math.max(1, Number(process.env.FILS ?? 3));
const JUGER = GRAINES >= 32;
const FORCE = Number(process.env.FORCE ?? 1.5);
/* Une signature moyenne vaut 22 points de cote et ≈ 2 points de chance ; un point de pourcentage sur un canal, ≈ 0,2 (mesurés le 13 nov. 2026) : 2,2 points de cote par point de pourcentage, et la moitié de plus pour qui vise la marche d'après. */
const POIDS = Number(process.env.POIDS ?? 3.3);
const PRIX_ESPACE = 1.5, N_CHANCE = 40, ECART_III = 10, BUILDS = 3, EXPLOSE = 0.75;
const ROBOTS = (process.env.ROBOTS || 'malin,batisseur').split(',');
const DEPART_N = Number(process.env.DEPART_N ?? 3);

/*
 * LES PIÈCES D'ESSAI : chacune compte les paliers d'un ou deux badges chez tes habillés (Bronze 1 à Platine 4, le second
 * badge à moitié) et bouge un canal du moteur, tout le match, PAR SEUILS : rien sous le premier, puis trois marches de
 * plus en plus hautes (`seuils` : [paliers, %]). Les six premières comptent ce que la cote donne déjà (le malin
 * d'aujourd'hui finit avec 12 paliers de sniper, 10 de passeur, 11 de deux-sens) : leur premier seuil est à sa portée,
 * les suivants demandent de bâtir. Les trois dernières comptent ce que la cote ne donne pas (1 palier de checker, 0,3
 * de plombier).
 *
 * ESSAYÉ D'ABORD, ET ÉCARTÉ (13 nov. 2026, 48 graines) : les mêmes pièces EN LIGNE DROITE (1,5 à 4 % par palier). Le banc
 * valait +12 à +16 points de chance à l'acte III, mais bâtir ne payait pas : le robot qui ne lit pas son banc tenait
 * 66 % de ses cibles, le bâtisseur 67 % (+0,7 point en paires, bruit ±10,8) — chaque palier payant pareil, un banc se
 * paie en cote ce qu'il rapporte. Il manquait la prime à la concentration.
 */
const ESSAIS = {
  'b:tireurs': { nom: 'Les tireurs', badges: ['F:sniper'], cote: 'canaux', canal: 'finition', seuils: [[8, 8], [14, 25], [20, 50]] },
  'b:passeurs': { nom: 'Les passeurs', badges: ['F:passeur'], cote: 'canaux', canal: 'volume', seuils: [[8, 8], [13, 25], [18, 50]] },
  'b:pointe': { nom: 'La pointe', badges: ['D:offensif'], cote: 'canaux', canal: 'volume', seuils: [[6, 8], [10, 22], [14, 45]] },
  'b:relance': { nom: 'La relance', badges: ['D:manieur'], cote: 'canaux', canal: 'finition', seuils: [[5, 8], [8, 22], [12, 45]] },
  'b:gros': { nom: 'Les gros', badges: ['F:power'], cote: 'canaux', canal: 'volume', seuils: [[5, 8], [9, 25], [13, 50]] },
  'b:deuxsens': { nom: 'Les deux sens', badges: ['F:deuxsens', 'D:deuxsens'], cote: 'adv', canal: 'finition', seuils: [[9, 8], [15, 22], [21, 45]] },
  'b:etouffoir': { nom: 'L\'étouffoir', badges: ['F:checker'], cote: 'adv', canal: 'volume', seuils: [[4, 10], [7, 25], [10, 50]] },
  'b:plombiers': { nom: 'Les plombiers', badges: ['F:energie', 'F:bagarreur'], cote: 'adv', canal: 'finition', seuils: [[3, 10], [6, 25], [9, 50]] },
  'b:muraille': { nom: 'La muraille', badges: ['D:defensif', 'D:physique'], cote: 'adv', canal: 'volume', seuils: [[4, 10], [7, 25], [10, 50]] },
};
/*
 * LES ORIGINES : cinq pièces qui comptent d'où viennent tes joueurs — chaque porte est un vrai vestiaire,
 * une saison, une franchise. Le plus gros groupe de ton effectif : la même décennie, la même franchise, le même club de la
 * même saison (de vrais coéquipiers) ; et deux époques nommées. Ce compte-là ne se paie pas en cote : derrière la bonne
 * porte, on signe encore le meilleur.
 */
const leGros = cle => joueurs => { const c = new Map(); for (const p of joueurs) c.set(cle(p), (c.get(cle(p)) || 0) + 1); return Math.max(0, ...c.values()); };
const annee = p => Number(String(p.s).slice(0, 4));
const ORIGINES = {
  'b:epoque': { nom: 'L\'époque', n: leGros(p => Math.floor(annee(p) / 10)), cote: 'canaux', canal: 'finition', seuils: [[8, 8], [12, 25], [16, 50]] },
  'b:franchise': { nom: 'La franchise', n: leGros(p => p.t), cote: 'canaux', canal: 'volume', seuils: [[4, 8], [7, 25], [10, 50]] },
  'b:coequipiers': { nom: 'Les coéquipiers', n: leGros(p => `${p.s}:${p.t}`), cote: 'adv', canal: 'finition', seuils: [[3, 8], [5, 25], [8, 50]] },
  'b:anciens': { nom: 'Les anciens', n: joueurs => joueurs.filter(p => annee(p) < 1985).length, cote: 'adv', canal: 'volume', seuils: [[6, 8], [10, 25], [14, 50]] },
  'b:modernes': { nom: 'Les modernes', n: joueurs => joueurs.filter(p => annee(p) >= 2010).length, cote: 'canaux', canal: 'volume', seuils: [[6, 8], [10, 25], [14, 50]] },
};
/* `JEU` : les deux sortes ensemble (JP, 14 nov. 2026 : « les deux »), ou une seule (`badges`, `origines`) pour les comparer. */
const JEU = process.env.JEU || 'tout';
if (JEU === 'origines') for (const k of Object.keys(ESSAIS)) delete ESSAIS[k];
if (JEU !== 'badges') Object.assign(ESSAIS, ORIGINES);
for (const k of (process.env.SANS || '').split(',').filter(Boolean)) delete ESSAIS[`b:${k}`];
/* La pièce de départ de chaque coach, à l'essai : sa philosophie dit ce que ton banc compte dès le camp (`DEPART=0` : la pièce d'aujourd'hui). */
const DEPART = { essaim: 'b:passeurs', rapaces: 'b:tireurs', tortue: 'b:muraille', rhinos: 'b:plombiers', souffle: 'b:deuxsens', choeur: 'b:etouffoir', profondeur: 'b:gros', etoiles: 'b:pointe' };
const HABILLES = SLOTS.filter(s => !s.extra && !s.scratch), CASES = SLOTS.filter(s => !s.extra);
const groupe = p => (p.p === 'G' ? 'G' : p.p === 'D' ? 'D' : 'F');
/* Les paliers d'un joueur que la pièce compte. */
const paliers = (p, E) => (p ? badgesDe(p).reduce((a, b) => a + (E.badges.includes(`${groupe(p)}:${b.cle}`) ? (b.second && !b.plein ? b.palier / 2 : b.palier) : 0), 0) : 0);
/* Le compte d'une pièce sur une liste de joueurs : ses paliers de badge (tes habillés), ou sa fonction `n` (tout ton effectif). */
const compteSur = (joueurs, E) => (E.n ? E.n(joueurs.filter(Boolean)) : joueurs.reduce((a, p) => a + paliers(p, E), 0));
const listeDe = (S, E) => (E.n ? CASES : HABILLES).map(s => S.roster[s.i]);
const compte = (S, E) => compteSur(listeDe(S, E), E);
/* Le compte après un échange : celui qui sort remplacé par celui qui arrive, à sa case. */
const compteApres = (S, E, c) => compteSur(listeDe(S, E).map(p => (p === c.sortant ? c.p : p)), E);
/* Ce qu'une pièce rend, en % : la marche atteinte (le match), ou la pente entre deux marches (ce que le bâtisseur lit pour s'y rendre). */
const marche = (n, E) => FORCE * E.seuils.reduce((a, [seuil, p]) => (n >= seuil ? p : a), 0);
const pente = (n, E) => {
  if (n <= 0) return 0;
  const pts = [[0, 0], ...E.seuils], k = pts.findIndex(([seuil]) => n < seuil);
  if (k < 0) return FORCE * pts.at(-1)[1];
  const [n0, p0] = pts[k - 1], [n1, p1] = pts[k];
  return FORCE * (p0 + (p1 - p0) * (n - n0) / (n1 - n0));
};
const pctDe = (S, E) => marche(compte(S, E), E);
/* Le multiplicateur du canal : le tien monte (jusqu'à ×3), le leur descend (jamais sous le quart : ×1 / (1 + %), pour qu'une pièce forte n'annule rien). */
const facteur = (S, E) => (E.cote === 'adv' ? Math.max(0.25, 1 / (1 + pctDe(S, E) / 100)) : Math.min(3, 1 + pctDe(S, E) / 100));
/* Le rang de la marche atteinte, de 0 à 3. */
const rangDe = (S, E) => E.seuils.filter(([seuil]) => compte(S, E) >= seuil).length;

/* La séance en cours : les pièces d'essai lisent ton effectif au moment où le moteur lit leurs canaux. */
let SEANCE = null;
function poserLesEssais() {
  for (const [cle, E] of Object.entries(ESSAIS)) {
    const P = { voie: null, cadre: 3, genre: 'synergie', ico: '🧪', nom: E.nom, quandMot: 'Tout le match', dit: '', quand: () => true, essai: true };
    Object.defineProperty(P, E.cote, { enumerable: true, get: () => (SEANCE ? { [E.canal]: facteur(SEANCE, E) } : {}) });
    PIECES[cle] = P;
  }
}
const essaisDe = S => S.R.banc.filter(k => ESSAIS[k]);
/* Ce que les deux robots partagent : seules les pièces d'essai se prennent ; banc plein, la pièce d'avant sort d'abord. */
const offertesDEssai = offertes => offertes.filter(k => ESSAIS[k]);
const prixDeLEspace = (S, c) => PRIX_ESPACE * Math.max(0, (prixDe(S, c.p) - RUN.RACHAT * prixDe(S, c.sortant)) / 1e6);
const LIRE = {
  // LE TÉMOIN : le malin d'aujourd'hui (la cote au prix de l'espace, le chemin, le plan du duel), qui ne lit pas son banc.
  malin: {
    note: (S, c) => c.gain - prixDeLEspace(S, c),
    piece: (S, offertes) => offertesDEssai(offertes)[0] || null,
    sort: S => S.R.banc.find(k => !ESSAIS[k]) || null,
  },
  chiffre: {
    note: (S, c) => c.gain,
    piece: (S, offertes) => offertesDEssai(offertes)[0] || null,
    sort: S => S.R.banc.find(k => !ESSAIS[k]) || null,
  },
  batisseur: {
    // La cote au prix de l'espace (le malin d'aujourd'hui), plus ce que l'échange ajoute à ce que le banc compte.
    note: (S, c) => c.gain - prixDeLEspace(S, c)
      + POIDS * essaisDe(S).reduce((a, k) => a + pente(compteApres(S, ESSAIS[k], c), ESSAIS[k]) - pente(compte(S, ESSAIS[k]), ESSAIS[k]), 0),
    // La pièce la plus avancée chez lui, sur sa pente.
    piece: (S, offertes) => offertesDEssai(offertes).sort((a, b) => pente(compte(S, ESSAIS[b]), ESSAIS[b]) - pente(compte(S, ESSAIS[a]), ESSAIS[a]))[0] || null,
    // Banc plein : la pièce d'avant sort ; sinon la pièce d'essai la moins avancée, si la neuve l'est plus.
    sort: (S, cle) => S.R.banc.find(k => !ESSAIS[k]) || (b => (pente(compte(S, ESSAIS[b]), ESSAIS[b]) < pente(compte(S, ESSAIS[cle]), ESSAIS[cle]) ? b : null))(essaisDe(S).sort((a, b) => pente(compte(S, ESSAIS[a]), ESSAIS[a]) - pente(compte(S, ESSAIS[b]), ESSAIS[b]))[0]),
  },
};

/* ---------- les processus ---------- */
if (process.env.BRAS) {
  poserLesEssais();
  const [robot, a, b] = process.env.BRAS.split(':'), res = [];
  for (let g = Number(a); g < Number(b); g++) {
    const chances = [[], [], []], vides = [];
    const espion = (m, S) => {
      // Le premier appel est au camp, avant toute signature : la pièce de départ d'essai prend la case de celle d'aujourd'hui.
      if (SEANCE !== S && process.env.DEPART !== '0') {
        // `DEPART_N` pièces dès le camp (1 : celle du coach, ou une tirée de la graine si son jeu de pièces n'en a pas) : les mêmes pour chaque robot.
        const tirees = Object.keys(ESSAIS).map(k => [hache(String(g), 'depart', k), k]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
        const premiere = ESSAIS[DEPART[S.R.coach.cle]] ? DEPART[S.R.coach.cle] : tirees[0];
        S.R.banc = [premiere, ...tirees.filter(k => k !== premiere).slice(0, DEPART_N - 1)];
        rebatir(S);
      }
      SEANCE = S;
      if (m === 'case' && S.R.phase === 'feuille' && !S.R.series) {
        const c = chanceCeSoir(S, { n: N_CHANCE });
        chances[S.R.acte].push(c.v / c.n);
        // Ce que le banc vaut, à l'acte III : le même soir, banc vide.
        if (S.R.acte === 2) { const garde = S.toi.perso.banc; S.toi.perso.banc = []; const v = chanceCeSoir(S, { n: N_CHANCE }); S.toi.perso.banc = garde; vides.push(v.v / v.n); }
      }
      if (m === 'fin') fin = { banc: essaisDe(S).map(k => ({ cle: k, pct: Math.round(pctDe(S, ESSAIS[k])), rang: rangDe(S, ESSAIS[k]) })), cases: S.R.banc.length };
    };
    let fin = null;
    const r = jouerLaRun(robot === 'chiffre' ? 'chiffre' : 'malin', g, { espion, lire: LIRE[robot] });
    res.push({ robot, graine: g, coach: r.coach, actes: r.actes, coupe: r.coupe, cause: r.fin && r.fin.cause, signatures: r.signatures, forces: r.forces, chances, vides, ...fin });
  }
  process.stdout.write(JSON.stringify(res));
  process.exit(0);
}
const lancer = bras => new Promise((ok, ko) => {
  const p = spawn(process.execPath, [ICI], { env: { ...process.env, BRAS: bras } });
  let txt = '';
  p.stdout.on('data', x => { txt += x; });
  p.stderr.on('data', x => process.stderr.write(x));
  p.on('close', c => (c === 0 ? ok(JSON.parse(txt)) : ko(new Error(`le bras ${bras} a échoué (${c})`))));
});
const pas = Math.max(1, Math.ceil(GRAINES / FILS));
const taches = ROBOTS.flatMap(r => Array.from({ length: Math.ceil(GRAINES / pas) }, (_, k) => `${r}:${k * pas}:${Math.min(GRAINES, (k + 1) * pas)}`));
const runs = [];
for (let i = 0; i < taches.length; i += FILS) runs.push(...(await Promise.all(taches.slice(i, i + FILS).map(lancer))).flat());

const moy = l => (l.length ? l.reduce((a, x) => a + x, 0) / l.length : 0), pct = x => `${Math.round(100 * x)} %`;
const de = r => runs.filter(x => x.robot === r);
const tenues = x => moy(x.actes.map(a => (a.tenu ? 1 : 0)));
const chanceIII = x => (x.chances[2].length ? moy(x.chances[2]) : null);
const plusForte = x => (x.banc.length ? x.banc.slice().sort((a, b) => b.pct - a.pct)[0] : null);
for (const r of ROBOTS) {
  const l = de(r), iii = l.map(chanceIII).filter(x => x != null);
  informer(`Le robot ${r}`, `${l.filter(x => x.coupe).length} Coupes sur ${l.length} · cibles tenues ${pct(moy(l.flatMap(x => x.actes.map(a => (a.tenu ? 1 : 0)))))} · chance aux actes I, II, III : ${[0, 1, 2].map(a => pct(moy(l.flatMap(x => x.chances[a])))).join(', ')} · ${pct(iii.filter(x => x >= EXPLOSE).length / l.length)} des runs à ${pct(EXPLOSE)} à l'acte III · sans cœur ${l.filter(x => x.cause === 'coeurs').length} · ${moy(l.map(x => x.signatures)).toFixed(1)} signatures · force ${moy(l.map(x => x.forces[0])).toFixed(0)} → ${moy(l.map(x => x.forces.at(-1))).toFixed(0)}`);
  const avecBanc = l.filter(x => x.vides.length).map(x => moy(x.chances[2]) - moy(x.vides));
  informer('Ce que son banc vaut à l\'acte III', `${avecBanc.length ? `+${(100 * moy(avecBanc)).toFixed(0)} points de chance en moyenne contre le même soir banc vide (${avecBanc.length} runs) ; le quart du haut à +${(100 * (avecBanc.slice().sort((p, q) => q - p)[Math.floor(avecBanc.length / 4)] || 0)).toFixed(0)}` : 'aucune run à l\'acte III'}`);
  const rangs = l.flatMap(x => x.banc.map(y => y.rang));
  informer(`Son banc à la fin`, `${moy(l.map(x => x.banc.length)).toFixed(1)} pièces d'essai, la plus forte à ${moy(l.map(x => (plusForte(x) ? plusForte(x).pct : 0))).toFixed(0)} % en moyenne, le banc entier à ${moy(l.map(x => x.banc.reduce((a, y) => a + y.pct, 0))).toFixed(0)} % cumulés · ses pièces sous le premier seuil ${pct(rangs.filter(r => r === 0).length / Math.max(1, rangs.length))}, à la 1re marche ${pct(rangs.filter(r => r === 1).length / Math.max(1, rangs.length))}, à la 2e ${pct(rangs.filter(r => r === 2).length / Math.max(1, rangs.length))}, à la 3e ${pct(rangs.filter(r => r === 3).length / Math.max(1, rangs.length))}`);
}
const B = de('batisseur'), C = de(ROBOTS.includes('malin') ? 'malin' : 'chiffre'), TEMOIN = ROBOTS.includes('malin') ? 'le malin' : 'le chiffre';
if (B.length && C.length) {
  const paires = B.map(b => [b, C.find(c => c.graine === b.graine)]).filter(x => x[1]);
  const d = paires.map(([b, c]) => tenues(b) - tenues(c)), m = moy(d), bruit = 2 * Math.sqrt(d.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, d.length - 1) / d.length);
  const mot = `cibles tenues ${pct(moy(B.flatMap(x => x.actes.map(a => (a.tenu ? 1 : 0)))))} contre ${pct(moy(C.flatMap(x => x.actes.map(a => (a.tenu ? 1 : 0)))))} : ${m >= 0 ? '+' : ''}${(100 * m).toFixed(1)} points en paires, le bruit à ±${(100 * bruit).toFixed(1)}`;
  const iii = paires.map(([b, c]) => [chanceIII(b), chanceIII(c)]).filter(x => x[0] != null && x[1] != null);
  const ecart = 100 * (moy(iii.map(x => x[0])) - moy(iii.map(x => x[1])));
  const gagnants = B.filter(x => x.actes.length === 3 && x.actes.every(a => a.tenu)).map(plusForte).filter(Boolean), sortes = [...new Set(gagnants.map(x => x.cle))];
  const motBuilds = `${sortes.length} pièces : ${sortes.map(k => `${ESSAIS[k].nom} ${gagnants.filter(x => x.cle === k).length}`).join(', ') || 'aucune'} (${gagnants.length} runs à trois cibles)`;
  if (JUGER) {
    exiger(`Bâtir paie, sans 384 graines : en paires, le bâtisseur tient plus de cibles que ${TEMOIN}, au-delà du bruit`, m > bruit, mot);
    exiger(`Le club décolle : à l'acte III, le bâtisseur joue au moins ${ECART_III} points de chance au-dessus de ${TEMOIN.replace('le ', '')}`, ecart >= ECART_III, `${ecart >= 0 ? '+' : ''}${ecart.toFixed(1)} points sur ${iii.length} paires arrivées à l'acte III`);
    exiger(`Plus d'un build gagne : au moins ${BUILDS} pièces différentes sont la plus forte d'un banc qui tient ses trois cibles`, sortes.length >= BUILDS, motBuilds);
  } else {
    informer('L\'essai court', `${GRAINES} graines, rien ne se juge sous 32 · ${mot} · acte III ${ecart >= 0 ? '+' : ''}${ecart.toFixed(1)} points · ${motBuilds}`);
  }
}
informer('Le réglage', `JEU=${JEU} · FORCE=${FORCE} · POIDS=${POIDS} · DEPART_N=${DEPART_N} · ${Object.keys(ESSAIS).length} pièces d'essai`);
verdict('Le build décide : le test d\'un jour (V29, tranche 0)');
