/*
 * LES JAMBES DES GARDIENS (1.0, C4) — les départs de suite, et le choix du soir.
 *
 * JP : *je comprends pas la gestion des gardiens*. Un gardien garde ses jambes
 * trois départs de suite ; au quatrième, il en perd 5 par départ, et chaque
 * 5 points perdus lui coûtent 1 % de buts accordés de plus (jusqu'à 12 %).
 * Une soirée sans départ lui rend tout. Ce script prouve :
 *
 *   1. la règle, sur un gardien : 3 départs gratuits, puis la pente, puis le repos ;
 *   2. dans une vraie ligue, un « cheval de trait » envoyé dix soirs de suite
 *      (décisions « Devant le filet ce soir : le partant ») perd de son
 *      facteur d'arrêt contre le même gardien laissé à la rotation ;
 *   3. le choix du soir (« l'auxiliaire ce soir ») met bien l'auxiliaire au
 *      filet CE soir-là, et se rejoue au but près ;
 *   4. la rotation par défaut des clubs de l'IA garde leurs partants presque
 *      toujours frais (la ligue reste calibrée) ;
 *   5. LE BADGE DES GARDIENS (V2.3) : chaque partant de quinze départs en a un,
 *      lu dans ses vraies stats ; ses paliers suivent l'échelle des patineurs ;
 *      il est centré sur la ligue (le gardien moyen ne gagne rien) ; sa couleur
 *      est celle que le coach compte ; De fer garde ses jambes plus longtemps ;
 *      et la saison le LIT : le même gardien, Mur Platine ou sans badge, ne
 *      donne pas les mêmes buts.
 *
 *   node scripts/check_gardiens.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJournee, bilanLigue, SLOTS, getPlayerKey,
  jambesGardien, usureGardien, facteurGardienDe, badgeGardien, netBadgeGardien, suiteLibreDe, coachDuJoueur, BADGES_G, EFFET_GARDIEN,
  GARDIEN_SUITE_LIBRE } from '../js/sim.js';
import { lectureDuMatch } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { borne, exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function ligue(seed, n = 32) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)];
    const sh = shard(f);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const gardiensDe = t => SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => t.roster[s.i]);

/*
 * Ce que le moteur lit d'un gardien, sans dés (`lectureDuMatch` : la chance moyenne d'un lancer contre lui, sous
 * un hasard à part) : un Mur Platine à forces égales, un Acrobate Platine en désavantage numérique, chacun devant
 * le filet des deux cases. Le parent lit avec le badge ; un fils (`GARDIENS_FILS`) sans (`BADGE_G=0`, la molette
 * de preuve) — le même club, la même lecture.
 */
function lectureBadges() {
  const tous = SAISONS.flatMap(f => shard(f).players.filter(p => p.p === 'G' && (p.gp || 0) >= 15));
  const platine = cle => tous.filter(g => { const b = badgeGardien(g); return b && b.cle === cle && b.palier === 4; }).sort((a, b) => b.gp - a.gp)[0];
  const lu = (g, mode) => {
    const t = ligue(7300, 2)[0];
    const [i0, i1] = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => s.i);
    const a = { ...g }, b = { ...g, n: `${g.n} (2)` };
    registerHiddenRatings(a); registerHiddenRatings(b);
    t.roster[i0] = a; t.roster[i1] = b;
    return { n: g.n, s: g.s, x: lectureDuMatch(t).p.contre[mode] };
  };
  return { mur: lu(platine('mur'), 'FE'), acrobate: lu(platine('acrobate'), 'AN') };
}
if (process.env.GARDIENS_FILS === '1') { process.stdout.write(JSON.stringify(lectureBadges())); process.exit(0); }

console.log('\n  LES JAMBES DES GARDIENS\n');

// 1. La règle, sur un gardien.
{
  const g = { p: 'G', s: '1995-96', sv: 0.905, _suite: 0 };
  const lu = [];
  for (let n = 0; n <= 12; n++) { g._suite = n; lu.push(jambesGardien(g)); }
  console.log(`  jambes après n départs de suite : ${lu.map((v, n) => `${n}:${v}`).join(' ')}`);
  exiger('trois départs de suite ne coûtent rien', lu[0] === 100 && lu[1] === 100 && lu[2] === 100, lu.slice(0, 3).join(' · '));
  exiger('au quatrième, 5 points de moins par départ', lu[3] === 95 && lu[9] === 65, `${lu[3]} · ${lu[9]}`);
  g._suite = 9;
  const las = facteurGardienDe(g); g._suite = 0; const frais = facteurGardienDe(g);
  exiger('le 10e départ de suite accorde 7 % de buts de plus', Math.abs(las / frais - 1.07) < 1e-9, (las / frais).toFixed(3));
  g._suite = 30; exiger('la pente s\'arrête à 12 %', Math.abs(usureGardien(g) - 1.12) < 1e-9, usureGardien(g).toFixed(3));
}

/* Une saison au jour le jour : pour l'équipe 0, le gardien de chaque soir et ses jambes au matin. */
function saison(teams, graine, decisions) {
  const L = creerLigue(teams, 82, { graine, decisions });
  while (!L.fini) jouerJournee(L);
  bilanLigue(L);
  return L;
}

// 2. Le cheval de trait : le partant de l'équipe 0 envoyé tous les soirs, contre la rotation.
{
  const facteurs = { cheval: [], rotation: [] }, gaCheval = [], gaRot = [];
  for (let n = 0; n < 4; n++) {
    for (const bras of ['cheval', 'rotation']) {
      const teams = ligue(9100 + n);
      const decisions = bras === 'cheval' ? Array.from({ length: 90 }, (_, j) => ({ jour: j, equipe: 0, filet: 'partant' })) : [];
      // On lit l'usure du partant au moment de chaque départ, en suivant sa suite.
      const t = teams[0], [partant] = gardiensDe(t);
      const L = creerLigue(teams, 82, { graine: `gard-${n}`, decisions });
      const us = [];
      while (!L.fini) {
        const avant = t.games;
        const u = usureGardien(partant);
        jouerJournee(L);
        if (t.games > avant && t.journal[t.journal.length - 1].gardien === partant) us.push(u);
      }
      bilanLigue(L);
      facteurs[bras].push(moy(us));
      (bras === 'cheval' ? gaCheval : gaRot).push(t.GA);
    }
  }
  const fc = moy(facteurs.cheval), fr = moy(facteurs.rotation);
  console.log(`  cheval de trait : buts accordés ×${fc.toFixed(3)} en moyenne sur ses départs · laissé à la rotation : ×${fr.toFixed(3)}`);
  console.log(`  buts contre de l'équipe sur la saison : cheval ${moy(gaCheval).toFixed(1)} · rotation ${moy(gaRot).toFixed(1)}`);
  exiger('un partant envoyé tous les soirs perd de son facteur d\'arrêt', fc > fr + 0.03, `${fc.toFixed(3)} contre ${fr.toFixed(3)}`);
  informer('écart de buts contre sur la saison (cheval − rotation)', `${(moy(gaCheval) - moy(gaRot)).toFixed(1)} buts`);
}

// 3. Le choix du soir : l'auxiliaire, un soir où le partant est au filet, et il se rejoue.
// Le soir se cherche : depuis le vrai calendrier, le partant de l'équipe 0 est
// blessé au jour 10 (S84), et un partant blessé laisse le filet à l'auxiliaire.
{
  const joue = (decs, jourVoulu = null) => {
    const teams = ligue(9300);
    const L = saison(teams, 'filet-choix', decs);
    const t = teams[0], [partant, aux] = gardiensDe(t);
    const gardienDu = j => {
      const m = L.calendrier[j].find(x => x.A === t || x.B === t);
      const jn = m && t.journal.find(x => x.feuille === m.feuille);
      return jn ? jn.gardien : null;
    };
    // Le premier soir, à partir du jour 10, où la rotation envoie le partant.
    let jour = jourVoulu;
    for (let j = 10; jour == null && j < L.calendrier.length; j++) if (gardienDu(j) === partant) jour = j;
    // Ses départs JUSQU'À ce soir-là : après, une blessure qui tombe autrement change la suite (le jeu d'une saison rejouée).
    const m = jour == null ? null : L.calendrier[jour].find(x => x.A === t || x.B === t);
    const k = m ? t.journal.findIndex(x => x.feuille === m.feuille) : -1;
    const auxJusque = t.journal.slice(0, k + 1).filter(x => x.gardien === aux).length;
    return { t, partant, aux, jour, auxJusque, gardien: jour == null ? null : gardienDu(jour), pts: teams.map(x => `${x.W}-${x.L}-${x.OTL}-${x.GF}-${x.GA}`).join('|') };
  };
  const sans = joue([]);
  const jour = sans.jour;
  const avec = joue([{ jour, equipe: 0, filet: 'aux' }], jour);
  const encore = joue([{ jour, equipe: 0, filet: 'aux' }], jour);
  exiger(`sans choix, le jour ${jour} : le partant (la rotation)`, sans.gardien && getPlayerKey(sans.gardien) === getPlayerKey(sans.partant), sans.gardien ? sans.gardien.n : '—');
  exiger('« l\'auxiliaire ce soir » : l\'auxiliaire est au filet', avec.gardien && getPlayerKey(avec.gardien) === getPlayerKey(avec.aux), avec.gardien ? avec.gardien.n : '—');
  exiger('le choix se rejoue au but près', avec.pts === encore.pts);
  exiger('l\'auxiliaire compte un départ de plus ce soir-là', avec.auxJusque === sans.auxJusque + 1, `${sans.auxJusque} → ${avec.auxJusque}`);
}

/*
 * 3 bis. LE PARTANT BLESSÉ (S85). JP : *un gardien suprême avec des boosts, et
 * il est à chier*. Sa case vide laissait l'auxiliaire sur le banc et le rappel
 * du club-école au filet tous les soirs. Sur toute une ligue : un soir où le
 * partant manque et l'auxiliaire est là, c'est l'auxiliaire qui part — sauf la
 * part d'un auxiliaire, que le rappel prend (PART_SANS_AUX ; le troisième
 * gardien d'un vrai club, la part de son tandem).
 */
{
  const teams = ligue(9300);
  const L = creerLigue(teams, 82, { graine: 'filet-blesse' });
  const soirs = { aux: 0, rappel: 0, revenu: 0, autre: 0 };
  while (!L.fini) {
    const avant = teams.map(t => t.games);
    // Qui manquait AU MATIN : le partant blessé, l'auxiliaire en santé.
    const manque = teams.map(t => { const [s, b] = gardiensDe(t); return !!(s && b && t.injured.has(s) && !t.injured.has(b)); });
    const auxDe = teams.map(t => gardiensDe(t)[1]), partantDe = teams.map(t => gardiensDe(t)[0]);
    jouerJournee(L);
    teams.forEach((t, i) => {
      if (t.games === avant[i] || !manque[i]) return;
      const g = t.journal[t.journal.length - 1].gardien;
      // Le partant guéri dans la journée (les blessures se comptent au soir) n'est pas un soir sans lui.
      // Le rappel : celui du club-école, ou le troisième gardien du vrai club.
      soirs[g === auxDe[i] ? 'aux' : g === partantDe[i] ? 'revenu' : g && (g._rappel || g.p === 'G') ? 'rappel' : 'autre']++;
    });
  }
  const n = soirs.aux + soirs.rappel + soirs.autre;
  console.log(`  partant blessé, auxiliaire en santé : ${n} soirs — l'auxiliaire ${soirs.aux}, le rappel ${soirs.rappel}, un autre ${soirs.autre} (et ${soirs.revenu} soirs où le partant guérit le jour même)`);
  // La majorité, pas 70 % : le rappel prend la part d'un auxiliaire, et celle d'un vrai tandem (Worsley et Maniago) va à 40 %.
  exiger('partant blessé : l\'auxiliaire prend le filet la plupart des soirs', n >= 10 && soirs.aux / n >= 0.5 && !soirs.autre, `${soirs.aux} sur ${n}`);
}

// 4. La rotation de l'IA : ses partants restent frais.
{
  const teams = ligue(9500);
  const L = creerLigue(teams, 82, { graine: 'ia-rot' });
  const us = [];
  while (!L.fini) {
    const g0 = teams.map(t => t.games);
    const snap = teams.map(t => gardiensDe(t).map(g => (g ? usureGardien(g) : 1)));
    jouerJournee(L);
    teams.forEach((t, i) => {
      if (t.games === g0[i]) return;
      const gs = gardiensDe(t), g = t.journal[t.journal.length - 1].gardien, k = gs.indexOf(g);
      us.push(k >= 0 ? snap[i][k] : 1);
    });
  }
  bilanLigue(L);
  const m = moy(us), frais = us.filter(u => u === 1).length / us.length;
  console.log(`  rotation de l'IA : buts accordés ×${m.toFixed(4)} en moyenne · ${(frais * 100).toFixed(0)} % des départs sans usure`);
  borne('usure moyenne des départs de la ligue (la ligue reste calibrée)', m, 1, 1.03);
}

// 5. Le badge des gardiens (V2.3).
{
  const gs = [];
  for (const f of SAISONS) for (const p of shard(f).players) if (p.p === 'G' && (p.gp || 0) >= 15) gs.push(p);
  const bs = gs.map(g => [g, badgeGardien(g)]);
  exiger('chaque gardien de quinze départs a un badge', bs.every(([, b]) => b), `${bs.filter(([, b]) => !b).length} sans badge sur ${gs.length}`);
  exiger('sous quinze départs, pas de badge', !badgeGardien({ ...gs[0], gp: 14 }));
  const part = [1, 2, 3, 4].map(k => bs.filter(([, b]) => b && b.palier === k).length / bs.length);
  console.log(`  paliers des gardiens : ${part.map(x => `${(x * 100).toFixed(0)} %`).join(' · ')} (Bronze → Platine)`);
  borne('Bronze, la moitié des gardiens ou plus', part[0], 0.45, 0.7);
  borne('Platine, rare', part[3], 0.01, 0.08);
  // Centré : pondéré par les départs, le badge moyen de chaque style vaut ce que le moteur retranche à tous.
  for (const k of Object.keys(EFFET_GARDIEN)) {
    const avec = bs.filter(([, b]) => b && b.cle === k);
    if (!avec.length) continue;
    const [g0, b0] = avec[0], L = b0.palier / 4 - netBadgeGardien(g0) / EFFET_GARDIEN[k];
    const tot = bs.reduce((a, [g]) => a + g.gp, 0), m = avec.reduce((a, [g, b]) => a + g.gp * b.palier / 4, 0) / tot;
    borne(`${BADGES_G[k].nom} : centré sur la ligue (badge moyen ${m.toFixed(3)}, retranché ${L.toFixed(3)})`, m - L, -0.02, 0.02);
  }
  exiger('sa couleur est celle que le coach compte', bs.every(([g, b]) => coachDuJoueur(g) === BADGES_G[b.cle].coach));
  const fer = p => bs.find(([, b]) => b.cle === 'fer' && b.palier === p);
  const [f4] = fer(4) || [], [f3] = fer(3) || [], [f1] = fer(1) || [];
  exiger('De fer : deux départs libres de plus au Platine, un à l\'Or, aucun au Bronze',
    (!f4 || suiteLibreDe(f4) === GARDIEN_SUITE_LIBRE + 2) && (!f3 || suiteLibreDe(f3) === GARDIEN_SUITE_LIBRE + 1) && (!f1 || suiteLibreDe(f1) === GARDIEN_SUITE_LIBRE),
    `${f4 ? suiteLibreDe(f4) : '—'} · ${f3 ? suiteLibreDe(f3) : '—'} · ${f1 ? suiteLibreDe(f1) : '—'}`);
  // La saison le LIT : la même lecture du moteur, avec et sans le badge (la molette BADGE_G, dans un fils).
  const avecB = lectureBadges();
  const sansB = JSON.parse(String(execFileSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, GARDIENS_FILS: '1', BADGE_G: '0' }, maxBuffer: 1 << 24 })));
  for (const [k, mode] of [['mur', 'à forces égales'], ['acrobate', 'en désavantage']]) {
    const r = avecB[k].x / sansB[k].x, attendu = 1 - netBadgeGardien(gs.find(g => g.n === avecB[k].n && g.s === avecB[k].s));
    console.log(`  ${avecB[k].n} (${avecB[k].s}), ${BADGES_G[k].nom} Platine : un lancer ${mode} entre ×${r.toFixed(4)} (le badge annonce ×${attendu.toFixed(4)})`);
    exiger(`la saison lit le badge ${BADGES_G[k].nom} : ce que la fiche annonce, au dix-millième`, Math.abs(r - attendu) < 1e-4, `×${r.toFixed(4)} contre ×${attendu.toFixed(4)}`);
  }
}

verdict();
