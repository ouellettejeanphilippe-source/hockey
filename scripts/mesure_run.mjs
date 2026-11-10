/*
 * LA RUN EN CARTE, JOUÉE PAR DES ROBOTS SUR LE SIMULATEUR (V28, tranche 0 ; docs/refonte-v28.md § 4, § 10, la porte 0).
 *
 * JP, 9 nov. 2026 : la boucle, oui (la carte de l'acte, la feuille du soir, le match, les trois portes) ; le moteur, garder
 * le simulateur. Avant le moindre écran, on mesure si cette boucle, jouée par le moteur calibré, récompense celui qui lit :
 *
 *   LA RUN (une graine) : une décennie tirée, un coach (sa pièce de départ sur le banc), les bouche-trous du départ
 *   (scripts/lib/rogue_sim.mjs `vestiaire`, la bande de la V27), puis le camp (trois fois trois portes). Trois actes de
 *   cinq matchs et un rival : à chaque case, deux affiches (un club de la moitié basse de la bande de l'acte, un de la
 *   moitié haute) ; le match se joue isolé par le simulateur (`playGame`, les greffes du Rogue : la pièce joue), le
 *   rival en duel (`simulerGrosMatch`, son plan choisi par `robotDuel`). Après chaque match, trois portes : trois vrais
 *   vestiaires de la décennie, dont toujours le club affronté ; gagné contre l'affiche haute, une bande plus haute ; perdu,
 *   une relance. La cible de l'acte (`CIBLES`, sur 14 : 2 la victoire, 1 la défaite en prolongation, le rival double) ;
 *   2 cœurs ; les séries en trois rondes de 3 de 5 contre le haut de la décennie, une série perdue rachetée par un cœur.
 *
 *   LES ROBOTS, sur les mêmes dés : « premier » (la première affiche, le premier joueur de la première porte qui tient
 *   sous le plafond) ; le robot DU CHIFFRE (l'affiche la plus facile, le joueur à la meilleure cote, sans rien lire) ;
 *   le robot MALIN (ce qu'une carte montre : la cote au prix de l'espace qu'elle prend, `PRIX_ESPACE` ; l'affiche haute
 *   quand son club est au moins aussi fort ; le plan du rival lu à l'écran) ; et, à la demande (`ROBOTS=lit`), le robot
 *   qui ESSAIE AU MOTEUR (`N` matchs d'essai par candidat) — mesuré le 10 nov. 2026 : il choisit du bruit (+9 points au
 *   choix, −0,3 rejoués sur d'autres dés), un joueur ne vaut que ≈ 2 points de chance sur un match.
 *
 *   LES RÉGLAGES MESURÉS (docs/refonte-v28.md § 5) : `PORTES_APRES` (chaque match, `deux`, `rival`) et `RACHAT` (la part
 *   du salaire de celui qui sort qui se libère ; à 0,5, le plafond mord).
 *
 *   L'ORDRE DES TRIOS (`ORDRE=1`, à part) : la feuille du soir range tes quatre trios ; ce que vaut le meilleur des 24
 *   ordres contre l'ordre de `autoRoster`, choisi sur une moitié des dés et jugé sur l'autre (sinon le maximum de 24
 *   tirages bruités se mesure lui-même), sur des paires de vrais clubs.
 *
 * UN SOIR, PAS UNE SAISON (js/sim.js, l'exhibition) : `createTeam` tire la chance de saison de chaque club (`luck`) ; ici
 * chaque club qu'on crée (un candidat essayé, ton club après une signature, un ordre de trios) la remet à zéro, sinon deux
 * effectifs identiques ne jouent pas le même match sous les mêmes dés et la comparaison ne mesure que ce tirage.
 *
 * Simplifications de la tranche 0, dites : chaque match part de jambes fraîches et d'une infirmerie vide (l'usure d'un
 * match à l'autre se mesure à la tranche 3) ; les arrêts de la carte (le marché, le vestiaire, l'histoire) ne jouent pas.
 *
 *   node scripts/mesure_run.mjs                 les trois robots, `GRAINES` graines (64), `FILS` processus (4)
 *   GRAINES=4 FILS=2 node scripts/mesure_run.mjs   l'essai court : les bornes s'impriment sans se juger
 *   ORDRE=1 node scripts/mesure_run.mjs          l'ordre des trios seulement (`PAIRES` paires, 24)
 * Mesure seulement : jamais lu par le jeu.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  SLOTS, CAP, createTeam, autoRoster, registerHiddenRatings, getHiddenRatings, getPersonKey, teamStrength, grainerHasard,
  feuilleVierge, playGame, simulerGrosMatch,
} from '../js/sim.js';
import '../js/greffes.js';
import { PIECE_DU_COACH } from '../js/pieces.js';
import { ESPACE_DE_DEPART } from '../js/rogue.js';
import { SAISONS, shard, generateur, groupe, vestiaire, metaAuNiveau } from './lib/rogue_sim.mjs';
import { saisonFinie } from './lib/vestiaires.mjs';
import { robotDuel } from './lib/duel.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ICI = fileURLToPath(import.meta.url);
const GRAINES = Number(process.env.GRAINES ?? 64);
const FILS = Math.max(1, Number(process.env.FILS ?? 4));
const N = Number(process.env.N ?? 200);
/* Les matchs qui rejouent une signature sur d'autres dés, pour les trois robots : ce qu'elle vaut vraiment. */
const N_TENU = Number(process.env.N_TENU ?? 150);
const JUGER = GRAINES >= 32;
/* Les chiffres du devis (§ 4.2, § 5). */
const CIBLES = [7, 8, 9];
const COEURS = 2;
const MATCHS = 5;
const PORTES = 3;
/* Les bandes de force, en rang centile parmi les clubs de la décennie (0 le plus faible). */
const BANDES = [[0.15, 0.55], [0.3, 0.7], [0.45, 0.85]];
const RIVAUX = [0.65, 0.8, 0.92];
const SERIES = [0.82, 1];
const CAMP = [0.2, 0.6];
const CHANCE_HAUTE = Number(process.env.CHANCE_HAUTE ?? 0.45);
/* Quand les portes s'ouvrent : après `chaque` match, après le 2e et le 4e match de l'acte et le rival (`deux`), ou après le rival seulement (`rival`). */
const PORTES_APRES = process.env.PORTES_APRES || 'chaque';
/* La part du salaire de celui qui sort qui se libère (1 : tout ; 0,5 : la moitié reste au plafond, comme un rachat). */
const RACHAT = Number(process.env.RACHAT ?? 1);
const porteApres = m => PORTES_APRES === 'chaque' || (PORTES_APRES === 'deux' && (m === 1 || m === 3));
const ROBOTS = (process.env.ROBOTS || 'premier,chiffre,malin').split(',');
/* Le malin paie la cote au prix de l'espace qu'elle prend : un point de cote vaut `PRIX_ESPACE` M$ d'espace. */
const PRIX_ESPACE = Number(process.env.PRIX_ESPACE ?? 1.5);

/* ---------- les clubs de la décennie ---------- */
const v = p => getHiddenRatings(p).v;
const copie = p => { const c = { ...p }; registerHiddenRatings(c); return c; };
const force = t => { const f = teamStrength(t); return f.att + f.def + f.g; };
const DECENNIES = (() => {
  const par = new Map();
  for (const s of SAISONS) {
    if (!saisonFinie(s)) continue;
    const d = `${s.slice(0, 3)}0`;
    if (Number(d) < 1970) continue;
    (par.get(d) || par.set(d, []).get(d)).push(s);
  }
  return [...par].filter(([, ss]) => ss.length >= 5);
})();
const CLUBS = new Map();
function clubsDe(decennie) {
  if (CLUBS.has(decennie)) return CLUBS.get(decennie);
  const saisons = DECENNIES.find(([d]) => d === decennie)[1];
  const tous = [];
  for (const s of saisons) {
    for (const [t, ps] of Object.entries(shard(s).byTeam)) {
      const ok = ps.filter(p => (p.gp || 0) >= 10);
      const F = ok.filter(p => groupe(p) === 'F').sort((a, b) => v(b) - v(a)).slice(0, 12);
      const D = ok.filter(p => groupe(p) === 'D').sort((a, b) => v(b) - v(a)).slice(0, 6);
      const G = ok.filter(p => groupe(p) === 'G').sort((a, b) => (b.gp || 0) - (a.gp || 0)).slice(0, 2);
      if (F.length < 12 || D.length < 6 || G.length < 2) continue;
      const pool = [...F, ...D, ...G];
      const team = createTeam(t, t, autoRoster(pool), { season: s });
      team.courbe = true;
      team.luck = 0;
      tous.push({ s, t, team, pool, force: force(team) });
    }
  }
  tous.sort((a, b) => a.force - b.force);
  tous.forEach((c, i) => { c.rang = i / Math.max(1, tous.length - 1); });
  CLUBS.set(decennie, tous);
  return tous;
}
const dansLaBande = (clubs, [a, b]) => clubs.filter(c => c.rang >= a && c.rang <= b);
const pige = (rnd, l) => l[Math.floor(rnd() * l.length)];

/* ---------- ton club ---------- */
const masse = joueurs => joueurs.reduce((a, p) => a + (p.$ || 0), 0) + (joueurs.mort || 0);
function tonClub(joueurs, perso, politique) {
  const toi = createTeam('Rogue', 'YOU', autoRoster(joueurs), { isPlayer: true });
  toi.courbe = true;
  toi.luck = 0;
  toi.perso = structuredClone(perso);
  toi.robotDuel = robotDuel(['lit', 'malin'].includes(politique) ? 'attentif' : 'rien');
  return toi;
}

/* ---------- un match, isolé ---------- */
function preparer(t) {
  for (const s of SLOTS) { const p = t.roster[s.i]; if (p) { p.energie = 100; delete p._reserve; } }
  if (t.injured) t.injured.clear();
}
function jouer(toi, adv, graine, cle, visiteur = false) {
  grainerHasard(`${graine}:${cle}`);
  preparer(toi); preparer(adv);
  const f = feuilleVierge();
  const r = playGame(visiteur ? adv : toi, visiteur ? toi : adv, 1, false, false, f);
  return { gagne: r.winner === toi, ot: !!r.ot };
}
function duel(toi, adv, graine, cle, moment = null) {
  preparer(toi); preparer(adv);
  const r = simulerGrosMatch(toi, adv, { graine, cle, ...(moment ? { moment } : {}) });
  return { gagne: r.gagne, ot: !!(r.feuille && r.feuille.ot) };
}
/* La chance d'un club contre un autre, sur `n` matchs aux dés fixés par `sel` (les mêmes pour chaque candidat). */
function chance(toi, adv, sel, n = N) {
  let w = 0;
  for (let i = 0; i < n; i++) if (jouer(toi, adv, `essai:${sel}`, i, i % 2 === 1).gagne) w++;
  return w / n;
}

/* ---------- les portes ---------- */
function candidats(joueurs, porte, deja, plafond) {
  const m = masse(joueurs), out = [];
  for (const p of porte.pool) {
    if (deja.has(getPersonKey(p))) continue;
    const g = groupe(p);
    const sortant = joueurs.filter(x => groupe(x) === g).sort((a, b) => v(a) - v(b))[0];
    if (!sortant || m - RACHAT * (sortant.$ || 0) + (p.$ || 0) > plafond) continue;
    out.push({ p, sortant, gain: v(p) - v(sortant), porte });
  }
  return out;
}
/* Signer : l'arrivant entre, celui qui sort part ; la part de son salaire qui ne se libère pas reste au plafond (`mort`). */
function signer(joueurs, c) { const out = [...joueurs.filter(x => x !== c.sortant), copie(c.p)]; out.mort = (joueurs.mort || 0) + (1 - RACHAT) * (c.sortant.$ || 0); return out; }

/* ---------- une run ---------- */
export function jouerLaRun(robot, graine) {
  const t0 = Date.now();
  const rnd = generateur('v28', graine);
  const [decennie] = pige(rnd, DECENNIES);
  const clubs = clubsDe(decennie);
  const cles = Object.keys(PIECE_DU_COACH);
  const coach = pige(rnd, cles);
  const perso = { cle: coach, banc: [PIECE_DU_COACH[coach]], maitrise: 1 };
  const depart = vestiaire(generateur('v28-depart', graine), metaAuNiveau(0), [], [], { graine: `v28:${graine}:depart`, premiere: true }).roster;
  let joueurs = Object.values(depart).filter(Boolean).map(copie);
  const deja = new Set(joueurs.map(getPersonKey));
  // LE PLAFOND DE LA RUN (js/rogue-jeu.js `plafondDeDepart` en `reel`) : celui de la LNH, ou la masse du départ et son espace.
  const plafond = Math.max(CAP, masse(joueurs) + ESPACE_DE_DEPART);
  let toi = tonClub(joueurs, perso, robot);
  const out = { robot, graine, decennie, coach, actes: [], coeurs: COEURS, mort: 0, rate: false, rondes: 0, coupe: false, gains: [], gainsHorsEchantillon: [], forces: [force(toi)] };
  let relances = 0;

  // LA SIGNATURE : le robot choisit parmi les candidats des portes (ou passe).
  const ref = acte => dansLaBande(clubs, BANDES[Math.min(acte, 2)])[Math.floor(dansLaBande(clubs, BANDES[Math.min(acte, 2)]).length / 2)].team;
  const choisir = (portes, acte, cle) => {
    const tous = portes.flatMap(p => candidats(joueurs, p, deja, plafond)).sort((a, b) => b.gain - a.gain);
    if (!tous.length) return null;
    const adv = ref(acte), sel = `${graine}:${cle}`;
    let c = null;
    if (robot === 'premier') c = candidats(joueurs, portes[0], deja, plafond)[0] || null;
    else if (robot === 'chiffre') c = tous[0].gain > 0 ? tous[0] : null;
    else if (robot === 'malin') {
      // Ce qu'une carte montre : sa cote et son salaire contre ceux de qui sort.
      const note = x => x.gain - PRIX_ESPACE * Math.max(0, ((x.p.$ || 0) - RACHAT * (x.sortant.$ || 0)) / 1e6);
      const b = tous.filter(x => x.gain > 0).sort((a, b) => note(b) - note(a))[0];
      c = b && note(b) > 0 ? b : null;
    }
    else {
      // Qui lit : les trois meilleures cotes, et un de chaque autre porte, essayés au moteur sur les mêmes dés.
      const essai = [...new Set([...tous.slice(0, 3), ...portes.map(p => tous.find(x => x.porte === p)).filter(Boolean)])];
      const base = chance(toi, adv, sel);
      let best = null;
      for (const x of essai) {
        const p = chance(tonClub(signer(joueurs, x), perso, robot), adv, sel);
        if (!best || p > best.p) best = { ...x, p };
      }
      if (best && best.p > base) { c = best; out.gains.push(best.p - base); }
    }
    // La mesure gardée, pour chaque robot : la même signature rejouée sur d'autres dés (le choix ne se mesure pas lui-même).
    if (c && N_TENU > 0) {
      const sel2 = `${graine}:${cle}:tenu`;
      out.gainsHorsEchantillon.push(chance(tonClub(signer(joueurs, c), perso, robot), adv, sel2, N_TENU) - chance(toi, adv, sel2, N_TENU));
    }
    return c;
  };
  const ouvrir = (bande, affronte, acte, cle) => {
    const pool = dansLaBande(clubs, bande);
    let portes = [affronte, ...Array.from({ length: PORTES - 1 }, () => pige(rnd, pool))].filter(Boolean).slice(0, PORTES);
    let c = choisir(portes, acte, cle);
    if (robot === 'lit' && !c && relances > 0) { relances--; portes = Array.from({ length: PORTES }, () => pige(rnd, pool)); c = choisir(portes, acte, `${cle}:r`); }
    if (c) { joueurs = signer(joueurs, c); deja.add(getPersonKey(c.p)); toi = tonClub(joueurs, perso, robot); }
  };

  // LE CAMP : trois fois trois portes avant la première case.
  for (let k = 0; k < 3; k++) ouvrir(CAMP, null, 0, `camp${k}`);
  out.forces.push(force(toi));

  // LES TROIS ACTES.
  for (let a = 0; a < 3; a++) {
    const bande = BANDES[a], pool = dansLaBande(clubs, bande), mid = (bande[0] + bande[1]) / 2;
    let pts = 0, w = 0;
    for (let m = 0; m < MATCHS; m++) {
      const bas = pige(rnd, pool.filter(c => c.rang <= mid)), haut = pige(rnd, pool.filter(c => c.rang > mid));
      let adv;
      if (robot === 'premier') adv = rnd() < 0.5 ? bas : haut;
      else if (robot === 'chiffre') adv = bas;
      else if (robot === 'malin') adv = force(toi) >= haut.force ? haut : bas;
      else adv = chance(toi, haut.team, `${graine}:a${a}m${m}:affiche`, 60) >= CHANCE_HAUTE ? haut : bas;
      const r = jouer(toi, adv.team, `v28:${graine}`, `a${a}m${m}`, m % 2 === 1);
      if (r.gagne) { pts += 2; w++; } else if (r.ot) pts += 1;
      if (!r.gagne) relances++;
      const bandePortes = r.gagne && adv === haut ? [bande[1] - 0.1, Math.min(1, bande[1] + 0.15)] : bande;
      if (porteApres(m)) ouvrir(bandePortes, adv, a + (m >= 3 ? 1 : 0), `a${a}m${m}`);
    }
    // LE RIVAL : au sommet de l'acte, un duel ; il compte double.
    const rival = clubs[Math.round(RIVAUX[a] * (clubs.length - 1))];
    const r = duel(toi, rival.team, `v28:${graine}`, `rival${a}`);
    if (r.gagne) { pts += 4; w++; } else if (r.ot) pts += 2;
    const tenu = pts >= CIBLES[a];
    out.actes.push({ pts, w, tenu, rival: r.gagne, force: force(toi) });
    if (!r.gagne) relances++;
    ouvrir(r.gagne ? [Math.min(0.9, RIVAUX[a]), 1] : bande, rival, a + 1, `rival${a}`);
    if (!tenu) {
      if (a === 2) { out.rate = true; break; }
      if (--out.coeurs <= 0) { out.mort = a + 1; break; }
    }
  }
  out.forces.push(force(toi));

  // LES SÉRIES : trois rondes en 3 de 5, contre le haut de la décennie ; une série perdue se rachète par un cœur.
  if (!out.mort && !out.rate) {
    const haut = dansLaBande(clubs, SERIES);
    const adversaires = [0, 1, 2].map(() => pige(rnd, haut)).sort((x, y) => x.force - y.force);
    let ronde = 0, essai = 0;
    while (ronde < 3) {
      let wa = 0, wb = 0, k = 0;
      while (wa < 3 && wb < 3) {
        const r = duel(toi, adversaires[ronde].team, `v28:${graine}`, `s${ronde}e${essai}g${k++}`, { serie: true, ronde: ronde + 1 });
        if (r.gagne) wa++; else wb++;
      }
      if (wa === 3) { ronde++; out.rondes++; essai = 0; continue; }
      if (out.coeurs > 0 && essai === 0) { out.coeurs--; essai = 1; continue; }
      break;
    }
    out.coupe = ronde === 3;
  }
  out.s = Math.round((Date.now() - t0) / 1000);
  return out;
}

/* ---------- l'ordre des trios ---------- */
function permutations(a) { return a.length <= 1 ? [a] : a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r])); }
const ORDRES = permutations([0, 1, 2, 3]);
function enOrdre(team, ordre) {
  const roster = { ...team.roster };
  const trio = x => x.group === 'F' && !x.scratch && ['AG', 'C', 'AD'].includes(x.role) && x.unit < 4;
  for (const s of SLOTS.filter(trio)) {
    const src = SLOTS.find(x => trio(x) && x.unit === ordre[s.unit] && x.role === s.role);
    roster[s.i] = team.roster[src.i];
  }
  const t = createTeam(team.name, team.tag, roster, { isPlayer: true });
  t.courbe = true;
  t.luck = 0;
  return t;
}
export function mesurerLOrdre(i) {
  const rnd = generateur('v28-ordre', i);
  const [decennie] = pige(rnd, DECENNIES);
  const clubs = clubsDe(decennie);
  const toi = pige(rnd, dansLaBande(clubs, [0.3, 0.7])), adv = pige(rnd, dansLaBande(clubs, [0.3, 0.7]));
  const base = createTeam(toi.t, toi.t, autoRoster(toi.pool), { isPlayer: true });
  base.courbe = true;
  base.luck = 0;
  const choix = ORDRES.map(o => ({ o, p: chance(enOrdre(base, o), adv.team, `ordre:${i}:choix`, 200) })).sort((a, b) => b.p - a.p);
  const tenu = o => chance(enOrdre(base, o), adv.team, `ordre:${i}:tenu`, 400);
  return { decennie, toi: `${toi.t} ${toi.s}`, adv: `${adv.t} ${adv.s}`, defaut: tenu([0, 1, 2, 3]), meilleur: tenu(choix[0].o), pire: tenu(choix[choix.length - 1].o), ordre: choix[0].o.join('') };
}

/* ---------- les processus ---------- */
if (process.env.BRAS) {
  const [quoi, a, b] = process.env.BRAS.split(':');
  const res = [];
  for (let g = Number(a); g < Number(b); g++) res.push(quoi === 'ordre' ? mesurerLOrdre(g) : jouerLaRun(quoi, g));
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
async function enParallele(taches) {
  const res = new Array(taches.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(FILS, taches.length) }, async () => { while (i < taches.length) { const k = i++; res[k] = await taches[k](); } }));
  return res.flat();
}
const tranches = (quoi, n, pas) => Array.from({ length: Math.ceil(n / pas) }, (_, k) => () => lancer(`${quoi}:${k * pas}:${Math.min(n, (k + 1) * pas)}`));
const pct = x => `${Math.round(100 * x)} %`;
const moy = l => (l.length ? l.reduce((a, x) => a + x, 0) / l.length : 0);

if (process.env.ORDRE) {
  const PAIRES = Number(process.env.PAIRES ?? 24);
  const r = await enParallele(tranches('ordre', PAIRES, Math.max(1, Math.ceil(PAIRES / FILS))));
  for (const x of r) informer(`${x.toi} contre ${x.adv}`, `par défaut ${pct(x.defaut)} · le meilleur ordre (${x.ordre}) ${pct(x.meilleur)} · le pire ${pct(x.pire)}`);
  const gain = moy(r.map(x => x.meilleur - x.defaut)), perte = moy(r.map(x => x.defaut - x.pire));
  informer('L\'ordre des trios, sur des dés tenus à l\'écart', `le meilleur ordre +${(100 * gain).toFixed(1)} points sur l'ordre par défaut, le pire −${(100 * perte).toFixed(1)} ; ${new Set(r.map(x => x.ordre)).size} meilleurs ordres pour ${r.length} paires`);
  informer('La feuille du soir (§ 4.4)', gain >= 0.02 ? 'l\'ordre des trios est un choix : la feuille le présente' : 'sous 2 points : la feuille du soir ne le présente pas comme un choix');
  verdict('L\'ordre des trios (V28, tranche 0)');
} else {
  const pas = Math.max(1, Math.ceil(GRAINES / FILS));
  const runs = await enParallele(ROBOTS.flatMap(r => tranches(r, GRAINES, pas)));
  const de = r => runs.filter(x => x.robot === r);
  const tenues = r => moy(de(r).flatMap(x => x.actes.map(a => (a.tenu ? 1 : 0))));
  for (const r of ROBOTS) {
    const l = de(r);
    const parActe = [0, 1, 2].map(a => { const xs = l.filter(x => x.actes[a]); return `acte ${a + 1} ${pct(moy(xs.map(x => (x.actes[a].tenu ? 1 : 0))))} (${moy(xs.map(x => x.actes[a].pts)).toFixed(1)} pts)`; }).join(' · ');
    informer(`Le robot ${r}`, `${l.filter(x => x.coupe).length} Coupes sur ${l.length} · cibles tenues ${pct(tenues(r))} (${parActe}) · morts ${l.filter(x => x.mort).length} · séries manquées ${l.filter(x => x.rate).length} · ${moy(l.map(x => x.rondes)).toFixed(2)} ronde · force ${moy(l.map(x => x.forces[0])).toFixed(1)} → ${moy(l.map(x => x.forces.at(-1))).toFixed(1)} · ${moy(l.map(x => x.s)).toFixed(0)} s la run`);
  }
  for (const r of ROBOTS) {
    const g = de(r).flatMap(x => x.gainsHorsEchantillon);
    informer(`Les signatures de ${r}`, `${g.length} signées, ${(g.length / Math.max(1, de(r).length)).toFixed(1)} par run ; chacune, rejouée sur d'autres dés contre le club médian de l'acte : ${(100 * moy(g)) >= 0 ? '+' : ''}${(100 * moy(g)).toFixed(1)} points de chance${r === 'lit' ? ` (+${(100 * moy(de(r).flatMap(x => x.gains))).toFixed(1)} mesurés au choix)` : ''}`);
  }
  const gainsTenus = de('lit').flatMap(x => x.gainsHorsEchantillon);
  const ecart = tenues(ROBOTS.includes('lit') ? 'lit' : 'malin') - tenues('chiffre');
  const coupes = r => de(r).filter(x => x.coupe).length;
  if (JUGER) {
    if (ROBOTS.includes('lit') && ROBOTS.includes('chiffre')) exiger('Lire paie (la porte 0)', ecart >= 0.05, `qui lit tient ses cibles ${(100 * ecart).toFixed(1)} points plus souvent que le robot du chiffre (5 au moins)`);
    if (ROBOTS.includes('lit')) borne('Une signature bien choisie, rejouée sur d\'autres dés (points de chance)', +(100 * moy(gainsTenus)).toFixed(1), 3, 100);
    else informer('La signature du robot du chiffre', `${(100 * moy(de('chiffre').flatMap(x => x.gainsHorsEchantillon))).toFixed(1)} point de chance chacune, rejouée sur d'autres dés`);
    if (ROBOTS.includes('lit')) borne('Les Coupes de qui lit, sur 64', Math.round(coupes('lit') * 64 / GRAINES), 4, 12);
    else informer('Les Coupes du robot du chiffre, sur 64', String(Math.round(coupes('chiffre') * 64 / GRAINES)));
    borne('Les Coupes de « premier », sur 64', Math.round(coupes('premier') * 64 / GRAINES), 0, 2);
  } else {
    informer('L\'essai court', `${GRAINES} graines : qui lit tient ses cibles ${(100 * ecart).toFixed(1)} points plus souvent que le robot du chiffre ; Coupes ${ROBOTS.map(r => `${r} ${coupes(r)}`).join(', ')} ; les bornes ne se jugent qu'à 32 graines ou plus`);
  }
  verdict('La run en carte (V28, tranche 0)');
}
