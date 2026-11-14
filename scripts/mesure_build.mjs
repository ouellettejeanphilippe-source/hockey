/*
 * LE BUILD DÉCIDE — LA MESURE AVANT LE CODE (V29, tranches 0 et 0 bis ; docs/refonte-v29.md § 4, § 9, § 10). JP, 13 nov.
 * 2026 : *le roguelike est pas le fun, ni bâti comme il faut pour être un vrai jeu* ; il choisit « le build décide ».
 *
 * La question : sur le simulateur gardé, sans un geste pendant le match, un banc dont les pièces COMPTENT LES JOUEURS QUE
 * TU AS SIGNÉS (leurs badges, ou d'où ils viennent) et multiplient un canal du moteur tout le match, par marches,
 * sépare-t-il celui qui bâtit de celui qui ne lit pas son banc ? Rien du jeu n'est touché : les pièces d'essai (`ESSAIS`)
 * entrent dans la table `PIECES` le temps de la mesure, et les robots ne prennent qu'elles.
 *
 * LES RÈGLES À L'ESSAI, celles que JP a tranchées les 13 et 14 nov. 2026 :
 *   — les deux sortes de compte, les badges et l'origine (`JEU=badges|origines` pour n'en garder qu'une) ;
 *   — trois pièces dès le camp, celle du coach et deux tirées de la graine (`DEPART_N`) ;
 *   — seuls tes signés comptent : un bouche-trou du départ ne compte pour rien (`SIGNES=0` : tout l'effectif) ;
 *   — les jetons relancent les portes, `RELANCE` jetons puis le double à chaque relance du soir (`RELANCE=0` : jamais) ;
 *   — les séries sont le mur : leur coach joue la pièce de sa philosophie une marche au-dessus de sa ronde (`LEUR_PLUS`,
 *     la deuxième dès la première ronde) et quatre fois plus fort (`LEUR_FORCE`, tenant lieu d'un banc de pièces) ;
 *     `LEUR_COACH=0` : la pièce d'aujourd'hui ;
 *   — la difficulté monte tard (`DIFFICULTE`) : l'acte I comme aujourd'hui, l'acte III et les séries au plus haut.
 *
 * LES ROBOTS, sur les mêmes graines :
 *   le BÂTISSEUR  le robot qui lit d'aujourd'hui (la cote au prix de l'espace, le chemin, le plan du duel), plus ce que
 *                 l'échange change au compte de son banc (`POIDS` points de cote par point de pourcentage) ; il choisit
 *                 qui sort, prend la pièce la plus avancée chez lui, remplace la moins avancée, relance les portes ;
 *   le TÉMOIN     le même, à une seule différence : il ne lit pas son banc aux portes (sa note est celle de la cote) ;
 *   le CHIFFRE    (`ROBOTS=…,chiffre`) la meilleure cote, sans rien lire, la première pièce d'essai offerte.
 *
 * ON JUGE, à `GRAND` graines ou plus (docs/refonte-v29.md § 9) ; en dessous tout s'imprime avec son bruit, sans se juger :
 *   — bâtir paie : en paires, le bâtisseur tient plus de cibles que le témoin, au-delà de deux écarts-types ;
 *   — dur, mais ça explose : 15 à 35 % de ses runs jouent l'acte III à 75 % de chance ; la Coupe 4 à 12 fois sur 64 ;
 *     une run qui explose gagne la Coupe moins d'une fois sur deux (les séries sont le mur) ;
 *   — plus d'un build gagne : au moins cinq pièces mènent un banc qui tient ses trois cibles, aucune dans plus de 40 %.
 *
 * LA TRANCHE 0 (13 et 14 nov., 48 graines, avant la revue du devis) : huit variantes, lues au § 4 du devis. En ligne
 * droite (tant par palier) bâtir ne paie pas ; une seule pièce au départ arrive trop tard ; l'origine fait la décision,
 * les badges la puissance. La revue (§ 10) a montré que ce n'était pas une preuve : le témoin d'alors différait en trois
 * points (il prenait la première pièce offerte, n'en remplaçait aucune), les bouche-trous comptaient, les seuils étaient
 * calés sur l'effectif de fin de run. Cette version les corrige ; ses chiffres sont ceux de la tranche 0 bis.
 *
 * LA TRANCHE 0 BIS, JUGÉE LE 14 NOV. 2026 (256 graines, 2000 à 2255, le réglage par défaut) : le bâtisseur tient 81 % de ses
 * cibles, le témoin 60 % (+21,2 points en paires, bruit ±4,6), le chiffre 50 % ; 23 % des runs du bâtisseur explosent, et
 * une run qui explose gagne la Coupe 24 fois sur 59 ; onze pièces mènent un banc gagnant. Rouge : 14 Coupes sur 64 (4 à
 * 12), et 201 jetons en caisse à la fin (la relance ne les vide pas).
 *
 * LE SECOND JUGE, LE MÊME JOUR (256 autres graines, 3000 à 3255, le réglage par défaut d'aujourd'hui : la relance sous 40
 * points de cote, trois par soir, leur coach quatre fois plus fort) : cinq critères verts. Le bâtisseur 78 % de cibles
 * tenues, le témoin 57 % (+21,9 points, bruit ±4,8) ; 32 % de ses runs explosent ; 10 Coupes sur 64 ; une run qui explose
 * gagne la Coupe 29 fois sur 81 ; dix pièces mènent un banc gagnant. Il dépense 115 jetons par run en relances et en
 * garde 97 : le critère du devis (moins de 40) reste ouvert. Une pièce d'origine ne mène que 2 bancs gagnants sur 129.
 *
 *   node scripts/mesure_build.mjs                      les deux robots, `GRAINES` graines (48), `FILS` processus (3)
 *   GRAINES=256 GRAINE0=2000 ROBOTS=temoin,batisseur,chiffre node scripts/mesure_build.mjs   le juge : des graines neuves (une heure et quart sur trois fils)
 *   GRAINES=3 node scripts/mesure_build.mjs            l'essai court : rien ne se juge
 *   REGLAGES='{"ETAPES":[1,2,3,7]}' …                  un réglage de js/run.js `RUN`, le temps d'une mesure (ici la difficulté d'aujourd'hui)
 *   POIDS=3.3 FORCE=1.5 …                              le poids que le bâtisseur donne à son banc ; la force des marches
 *   SANS=tireurs,modernes …                            sans quelques pièces d'essai
 * Mesure seulement : jamais lu par le jeu, jamais en CI.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SLOTS, badgesDe, getPersonKey } from '../js/sim.js';
import { PIECES, PIECE_DU_COACH } from '../js/pieces.js';
import { RUN, chanceCeSoir, prixDe, rebatir } from '../js/run.js';
import { hache } from '../js/util.js';
import { jouerLaRun } from './lib/run_robot.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ICI = fileURLToPath(import.meta.url);
const env = (k, d) => Number(process.env[k] ?? d);
const GRAINES = env('GRAINES', 48), GRAINE0 = env('GRAINE0', 0), FILS = Math.max(1, env('FILS', 3)), GRAND = 128;
const FORCE = env('FORCE', 1.5), DEPART_N = env('DEPART_N', 3), RELANCE = env('RELANCE', 8);
const SIGNES_SEULS = process.env.SIGNES !== '0', LEUR_COACH = process.env.LEUR_COACH !== '0', LEUR_PLUS = env('LEUR_PLUS', 1), LEUR_FORCE = env('LEUR_FORCE', 4);
/* Une signature moyenne vaut 22 points de cote et ≈ 2 points de chance ; un point de pourcentage sur un canal, ≈ 0,2 (mesurés le 13 nov. 2026) : 2,2 points de cote par point de pourcentage, et la moitié de plus pour qui vise la marche d'après. */
const POIDS = env('POIDS', 3.3);
const PRIX_ESPACE = 1.5, N_CHANCE = 40, EXPLOSE = 0.75, BUILDS = 5, PART_MAX = 0.4;
/* Le bâtisseur et le témoin relancent les portes quand le meilleur échange offert vaut moins que `NOTE_FAIBLE` points de cote (une signature moyenne en vaut 22), `RELANCES_MAX` fois par soir au plus, en gardant de quoi payer une pièce au marché. */
const NOTE_FAIBLE = env('NOTE_FAIBLE', 40), RELANCES_MAX = env('RELANCES_MAX', 3), RESERVE = 32;
const ROBOTS = (process.env.ROBOTS || 'temoin,batisseur').split(',');
const JEU = process.env.JEU || 'tout';
/* LA DIFFICULTÉ À L'ESSAI (tranche 0 bis, réglée le 14 nov. 2026 sur les graines 1000 à 1047) : l'acte I comme aujourd'hui, l'acte II d'une étape d'édition de plus, l'acte III et les séries au plus haut. `REGLAGES` passe par-dessus. */
const DIFFICULTE = { ETAPES: [1, 3, 12, 12] };
Object.assign(RUN, DIFFICULTE, JSON.parse(process.env.REGLAGES || '{}'));

/*
 * LES PIÈCES D'ESSAI. Chacune compte quelque chose chez tes signés et bouge un canal du moteur, tout le match, PAR
 * MARCHES : rien sous le premier seuil, puis trois marches de plus en plus hautes (`seuils` : [compte, %], fois `FORCE`).
 * Les seuils sont posés pour un effectif de signés (trois au camp, huit à la fin de l'acte I, une vingtaine à la fin) :
 * la première marche à la portée de l'acte I pour qui la vise, la troisième pour qui a bâti autour d'elle.
 *   — les badges : les paliers d'un ou deux badges (Bronze 1 à Platine 4, le second badge à moitié) ;
 *   — l'origine : ton plus gros groupe de la même décennie, de la même franchise, du même club la même saison, et deux
 *     époques nommées. Ce compte-là ne se paie pas en cote : derrière la bonne porte, on signe encore le meilleur.
 */
const M = [8, 25, 50];
const marchesA = (a, b, c) => [[a, M[0]], [b, M[1]], [c, M[2]]];
const leGros = cle => joueurs => { const c = new Map(); for (const p of joueurs) c.set(cle(p), (c.get(cle(p)) || 0) + 1); return Math.max(0, ...c.values()); };
const annee = p => Number(String(p.s).slice(0, 4));
const BADGES = {
  'b:tireurs': { nom: 'Les tireurs', badges: ['F:sniper'], cote: 'canaux', canal: 'finition', seuils: marchesA(6, 12, 18) },
  'b:passeurs': { nom: 'Les passeurs', badges: ['F:passeur'], cote: 'canaux', canal: 'volume', seuils: marchesA(6, 11, 16) },
  'b:pointe': { nom: 'La pointe', badges: ['D:offensif'], cote: 'canaux', canal: 'volume', seuils: marchesA(4, 8, 12) },
  'b:manieurs': { nom: 'Les manieurs', badges: ['D:manieur'], cote: 'canaux', canal: 'finition', seuils: marchesA(3, 6, 10) },
  'b:gros': { nom: 'Les gros', badges: ['F:power'], cote: 'canaux', canal: 'volume', seuils: marchesA(3, 6, 10) },
  'b:deuxsens': { nom: 'Les deux sens', badges: ['F:deuxsens', 'D:deuxsens'], cote: 'adv', canal: 'finition', seuils: marchesA(5, 10, 16) },
  'b:etouffoir': { nom: 'L\'étouffoir', badges: ['F:checker'], cote: 'adv', canal: 'volume', seuils: marchesA(3, 5, 8) },
  'b:colsbleus': { nom: 'Les cols bleus', badges: ['F:energie', 'F:bagarreur'], cote: 'adv', canal: 'finition', seuils: marchesA(2, 4, 7) },
  'b:muraille': { nom: 'La muraille', badges: ['D:defensif', 'D:physique'], cote: 'adv', canal: 'volume', seuils: marchesA(3, 5, 8) },
};
const ORIGINES = {
  'b:epoque': { nom: 'L\'époque', n: leGros(p => Math.floor(annee(p) / 10)), cote: 'canaux', canal: 'finition', seuils: marchesA(5, 9, 13) },
  'b:franchise': { nom: 'La franchise', n: leGros(p => p.t), cote: 'canaux', canal: 'volume', seuils: marchesA(3, 5, 8) },
  'b:coequipiers': { nom: 'Les coéquipiers', n: leGros(p => `${p.s}:${p.t}`), cote: 'adv', canal: 'finition', seuils: marchesA(2, 3, 4) },
  'b:anciens': { nom: 'Les anciens', n: joueurs => joueurs.filter(p => annee(p) < 1985).length, cote: 'adv', canal: 'volume', seuils: marchesA(4, 8, 12) },
  'b:modernes': { nom: 'Les modernes', n: joueurs => joueurs.filter(p => annee(p) >= 2010).length, cote: 'canaux', canal: 'volume', seuils: marchesA(6, 10, 14) },
};
const ESSAIS = { ...(JEU !== 'origines' ? BADGES : {}), ...(JEU !== 'badges' ? ORIGINES : {}) };
for (const k of (process.env.SANS || '').split(',').filter(Boolean)) delete ESSAIS[`b:${k}`];
/* La pièce de départ de chaque coach, à l'essai : sa philosophie dit ce que ton banc compte dès le camp. */
const DEPART = { essaim: 'b:passeurs', rapaces: 'b:tireurs', tortue: 'b:muraille', rhinos: 'b:colsbleus', souffle: 'b:deuxsens', choeur: 'b:etouffoir', profondeur: 'b:gros', etoiles: 'b:pointe' };
/* Le canal de leur coach en séries, par philosophie : le sien (`canaux`) ou le tien (`adv`). */
const LEUR_CANAL = { essaim: ['canaux', 'volume'], rapaces: ['canaux', 'finition'], tortue: ['adv', 'volume'], rhinos: ['adv', 'finition'], souffle: ['adv', 'finition'], choeur: ['adv', 'volume'], profondeur: ['canaux', 'volume'], etoiles: ['canaux', 'finition'] };

/* ---------- le compte d'une pièce ---------- */
const CASES = SLOTS.filter(s => !s.extra);
const groupe = p => (p.p === 'G' ? 'G' : p.p === 'D' ? 'D' : 'F');
const paliers = (p, E) => badgesDe(p).reduce((a, b) => a + (E.badges.includes(`${groupe(p)}:${b.cle}`) ? (b.second && !b.plein ? b.palier / 2 : b.palier) : 0), 0);
const compteSur = (joueurs, E) => (E.n ? E.n(joueurs) : joueurs.reduce((a, p) => a + paliers(p, E), 0));
/* La séance en cours et ses signés (les clés de personne des joueurs signés dans la run) : les pièces d'essai lisent ton effectif au moment où le moteur lit leurs canaux. */
let SEANCE = null, SIGNES = new Set();
const compteUn = p => !SIGNES_SEULS || SIGNES.has(getPersonKey(p));
const comptes = S => CASES.map(s => S.roster[s.i]).filter(p => p && compteUn(p));
const compte = (S, E) => compteSur(comptes(S), E);
/* Le compte après un échange : celui qui sort n'y est plus, celui qui arrive est un signé. */
const compteApres = (S, E, c) => compteSur([...comptes(S).filter(p => p !== c.sortant), c.p], E);
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
const avance = (S, k) => pente(compte(S, ESSAIS[k]), ESSAIS[k]);
/* Le multiplicateur d'un canal : le tien monte (`1 + %`), le leur descend (`1 / (1 + %)`). */
const facteurDe = (cote, pct) => (cote === 'adv' ? 1 / (1 + pct / 100) : 1 + pct / 100);
const rangDe = (S, E) => E.seuils.filter(([seuil]) => compte(S, E) >= seuil).length;

function poserLesEssais() {
  for (const [cle, E] of Object.entries(ESSAIS)) {
    const P = { voie: null, cadre: 3, genre: 'synergie', ico: '🧪', nom: E.nom, quandMot: 'Tout le match', dit: '', quand: () => true, essai: true };
    Object.defineProperty(P, E.cote, { enumerable: true, get: () => (SEANCE ? { [E.canal]: facteurDe(E.cote, pctDe(SEANCE, E)) } : {}) });
    PIECES[cle] = P;
  }
  // LEUR COACH EN SÉRIES : la pièce de départ de sa philosophie (ton banc ne la porte plus) joue tout le match à la marche de la ronde.
  if (LEUR_COACH) for (const [voie, cle] of Object.entries(PIECE_DU_COACH)) {
    const [cote, canal] = LEUR_CANAL[voie], P = { ...PIECES[cle], quand: () => true, soir: false, relais: null, canaux: undefined, adv: undefined };
    Object.defineProperty(P, cote, { enumerable: true, get: () => { const ronde = SEANCE && SEANCE.R.series ? SEANCE.R.series.ronde : 0; return { [canal]: facteurDe(cote, LEUR_FORCE * FORCE * M[Math.min(2, ronde + LEUR_PLUS)]) }; } });
    PIECES[cle] = P;
  }
}
const essaisDe = S => S.R.banc.filter(k => ESSAIS[k]);
const offertesDEssai = offertes => offertes.filter(k => ESSAIS[k]);
const prixDeLEspace = (S, c) => PRIX_ESPACE * Math.max(0, (prixDe(S, c.p) - RUN.RACHAT * prixDe(S, c.sortant)) / 1e6);
/* Ce que le bâtisseur et le témoin font pareil : la pièce la plus avancée, la moins avancée qui sort si la neuve l'est plus, la relance des portes. */
const COMMUN = {
  piece: (S, offertes) => offertesDEssai(offertes).sort((a, b) => avance(S, b) - avance(S, a))[0] || null,
  sort: (S, cle) => S.R.banc.find(k => !ESSAIS[k]) || (b => (b && avance(S, b) < avance(S, cle) ? b : null))(essaisDe(S).sort((a, b) => avance(S, a) - avance(S, b))[0]),
  relancer: (S, meilleur, deja) => {
    if (S.R.relances > 0) return (!meilleur || meilleur.note < NOTE_FAIBLE) ? 0 : null;   // la relance gratuite d'après une défaite
    if (!RELANCE || deja >= RELANCES_MAX || (meilleur && meilleur.note >= NOTE_FAIBLE)) return null;
    const prix = RELANCE * 2 ** deja;
    return S.R.jetons >= prix + RESERVE ? prix : null;
  },
};
const LIRE = {
  temoin: { ...COMMUN, note: (S, c) => c.gain - prixDeLEspace(S, c) },
  batisseur: { ...COMMUN, note: (S, c) => c.gain - prixDeLEspace(S, c) + POIDS * essaisDe(S).reduce((a, k) => a + pente(compteApres(S, ESSAIS[k], c), ESSAIS[k]) - avance(S, k), 0) },
  chiffre: { note: (S, c) => c.gain, piece: (S, offertes) => offertesDEssai(offertes)[0] || null, sort: S => S.R.banc.find(k => !ESSAIS[k]) || null },
};

/* ---------- les processus ---------- */
if (process.env.BRAS) {
  poserLesEssais();
  const [robot, a, b] = process.env.BRAS.split(':'), res = [];
  for (let g = GRAINE0 + Number(a); g < GRAINE0 + Number(b); g++) {
    const chances = [[], [], []], vides = [];
    let fin = null, relances = 0, payees = 0;
    SIGNES = new Set(); SEANCE = null;
    const espion = (m, S, x) => {
      if (SEANCE !== S) {
        // Au camp, avant toute signature : `DEPART_N` pièces d'essai, celle du coach et d'autres tirées de la graine, les mêmes pour chaque robot.
        const tirees = Object.keys(ESSAIS).map(k => [hache(String(g), 'depart', k), k]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
        const premiere = ESSAIS[DEPART[S.R.coach.cle]] ? DEPART[S.R.coach.cle] : tirees[0];
        S.R.banc = [premiere, ...tirees.filter(k => k !== premiere).slice(0, DEPART_N - 1)];
        rebatir(S);
      }
      SEANCE = S;
      if (m === 'signe') SIGNES.add(getPersonKey(x.p));
      if (m === 'relance') { relances++; payees += x; }
      if (m === 'case' && S.R.phase === 'feuille' && !S.R.series) {
        const c = chanceCeSoir(S, { n: N_CHANCE });
        chances[S.R.acte].push(c.v / c.n);
        // Ce que le banc vaut, à l'acte III : le même soir, banc vide.
        if (S.R.acte === 2) { const garde = S.toi.perso.banc; S.toi.perso.banc = []; const v = chanceCeSoir(S, { n: N_CHANCE }); S.toi.perso.banc = garde; vides.push(v.v / v.n); }
      }
      if (m === 'fin') fin = { banc: essaisDe(S).map(k => ({ cle: k, pct: Math.round(pctDe(S, ESSAIS[k])), rang: rangDe(S, ESSAIS[k]) })), jetons: S.R.jetons };
    };
    const r = jouerLaRun(robot === 'chiffre' ? 'chiffre' : 'malin', g, { espion, lire: LIRE[robot] });
    res.push({ robot, graine: g, coach: r.coach, actes: r.actes, coupe: r.coupe, cause: r.fin && r.fin.cause, signatures: r.signatures, forces: r.forces, chances, vides, relances, payees, ...fin });
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

/* ---------- la lecture ---------- */
const moy = l => (l.length ? l.reduce((a, x) => a + x, 0) / l.length : 0), pct = x => `${Math.round(100 * x)} %`;
const de = r => runs.filter(x => x.robot === r);
const tenues = x => moy(x.actes.map(a => (a.tenu ? 1 : 0)));
const chanceIII = x => (x.chances[2].length ? moy(x.chances[2]) : null);
const explose = x => chanceIII(x) != null && chanceIII(x) >= EXPLOSE;
const plusForte = x => (x.banc.length ? x.banc.slice().sort((a, b) => b.pct - a.pct)[0] : null);
for (const r of ROBOTS) {
  const l = de(r), rangs = l.flatMap(x => x.banc.map(y => y.rang)), part = k => pct(rangs.filter(x => x === k).length / Math.max(1, rangs.length));
  const banc = l.filter(x => x.vides.length).map(x => moy(x.chances[2]) - moy(x.vides));
  informer(`Le robot ${r}`, `${l.filter(x => x.coupe).length} Coupes sur ${l.length} · cibles tenues ${pct(moy(l.flatMap(x => x.actes.map(a => (a.tenu ? 1 : 0)))))} (actes I, II, III : ${[0, 1, 2].map(a => pct(moy(l.filter(x => x.actes[a]).map(x => (x.actes[a].tenu ? 1 : 0))))).join(', ')}) · chance aux actes : ${[0, 1, 2].map(a => pct(moy(l.flatMap(x => x.chances[a])))).join(', ')} · ${pct(l.filter(explose).length / l.length)} des runs explosent, dont ${l.filter(x => explose(x) && x.coupe).length} Coupes sur ${l.filter(explose).length} · sans cœur ${l.filter(x => x.cause === 'coeurs').length} · ${moy(l.map(x => x.signatures)).toFixed(1)} signatures · force ${moy(l.map(x => x.forces[0])).toFixed(0)} → ${moy(l.map(x => x.forces.at(-1))).toFixed(0)}`);
  informer('  son banc', `${moy(l.map(x => x.banc.length)).toFixed(1)} pièces d'essai · à l'acte III il vaut ${banc.length ? `+${(100 * moy(banc)).toFixed(0)} points de chance contre le même soir banc vide` : '—'} · ses pièces sous le premier seuil ${part(0)}, à la 1re marche ${part(1)}, à la 2e ${part(2)}, à la 3e ${part(3)} · ${moy(l.map(x => x.relances)).toFixed(1)} relances par run (${moy(l.map(x => x.payees)).toFixed(0)} jetons) · ${moy(l.map(x => x.jetons)).toFixed(0)} jetons en caisse à la fin`);
}
const B = de('batisseur'), T = de('temoin');
if (B.length && T.length) {
  const paires = B.map(b => [b, T.find(c => c.graine === b.graine)]).filter(x => x[1]);
  const d = paires.map(([b, c]) => tenues(b) - tenues(c)), m = moy(d), bruit = 2 * Math.sqrt(d.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, d.length - 1) / d.length);
  const mot = `cibles tenues ${pct(moy(B.flatMap(x => x.actes.map(a => (a.tenu ? 1 : 0)))))} contre ${pct(moy(T.flatMap(x => x.actes.map(a => (a.tenu ? 1 : 0)))))} : ${m >= 0 ? '+' : ''}${(100 * m).toFixed(1)} points en paires, le bruit à ±${(100 * bruit).toFixed(1)}`;
  const iii = paires.map(([b, c]) => [chanceIII(b), chanceIII(c)]).filter(x => x[0] != null && x[1] != null);
  const gagnants = B.filter(x => x.actes.length === 3 && x.actes.every(a => a.tenu)).map(plusForte).filter(Boolean), sortes = [...new Set(gagnants.map(x => x.cle))];
  const compteDe = k => gagnants.filter(x => x.cle === k).length, pire = Math.max(0, ...sortes.map(compteDe)) / Math.max(1, gagnants.length);
  const motBuilds = `${sortes.length} pièces : ${sortes.sort((p, q) => compteDe(q) - compteDe(p)).map(k => `${ESSAIS[k].nom} ${compteDe(k)}`).join(', ') || 'aucune'} (${gagnants.length} runs à trois cibles)`;
  const explosent = B.filter(explose), partExplose = 100 * explosent.length / B.length, coupes64 = Math.round(B.filter(x => x.coupe).length * 64 / B.length);
  informer('L\'acte III, en paires', `le bâtisseur ${(100 * (moy(iii.map(x => x[0])) - moy(iii.map(x => x[1])))).toFixed(1)} points de chance au-dessus du témoin, sur ${iii.length} paires arrivées à l'acte III`);
  if (GRAINES >= GRAND) {
    exiger('Bâtir paie : en paires, le bâtisseur tient plus de cibles que le témoin, au-delà du bruit', m > bruit, mot);
    borne('Dur, mais ça explose : la part des runs du bâtisseur à 75 % de chance à l\'acte III, en %', Math.round(partExplose * 10) / 10, 15, 35);
    borne('Les Coupes du bâtisseur, sur 64', coupes64, 4, 12);
    exiger('Les séries sont le mur : une run qui explose gagne la Coupe moins d\'une fois sur deux', explosent.length > 0 && explosent.filter(x => x.coupe).length < explosent.length / 2, `${explosent.filter(x => x.coupe).length} Coupes sur ${explosent.length} runs qui explosent`);
    exiger(`Plus d'un build gagne : au moins ${BUILDS} pièces mènent un banc qui tient ses trois cibles, aucune dans plus de ${pct(PART_MAX)}`, sortes.length >= BUILDS && pire <= PART_MAX, motBuilds);
  } else {
    informer(`Sous ${GRAND} graines, rien ne se juge`, `${mot} · ${partExplose.toFixed(0)} % des runs explosent · ${coupes64} Coupes sur 64 · ${motBuilds}`);
  }
}
informer('Le réglage', `JEU=${JEU} · FORCE=${FORCE} · POIDS=${POIDS} · DEPART_N=${DEPART_N} · signés seuls ${SIGNES_SEULS ? 'oui' : 'non'} · RELANCE=${RELANCE} (sous ${NOTE_FAIBLE}, ${RELANCES_MAX} par soir) · leur coach ${LEUR_COACH ? `compté${LEUR_PLUS ? `, +${LEUR_PLUS} marche` : ''}${LEUR_FORCE !== 1 ? `, ×${LEUR_FORCE}` : ''}` : 'd\'aujourd\'hui'} · graines ${GRAINE0} à ${GRAINE0 + GRAINES - 1} · ETAPES ${RUN.ETAPES.join(' ')} · ${Object.keys(ESSAIS).length} pièces d'essai`);
verdict('Le build décide : la mesure avant le code (V29, tranches 0 et 0 bis)');
