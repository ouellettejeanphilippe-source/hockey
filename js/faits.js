/*
 * LES FAITS (V25 C1, docs/refonte-v25.md § 4 C ; docs/refonte-v25-c1.md). Ce qu'une histoire lit avant de s'ouvrir, et
 * ce que sa voix dit en chiffres, sortait de l'écran (js/saison.js `faitsDuLundi`, `faitsDesJoueurs`, `faitsDuProprio`)
 * et de la banque (js/dossiers.js `faitsDeLaCourse`, `faitsDuDernier`, `faitsDesSuites`) ; le robot en gardait une
 * copie (scripts/lib/cartes_robot.mjs). Il n'en reste qu'une lecture, PURE : `faitsDe({ ligue, you, jour, run, series })`
 * rend un objet lu dans les feuilles déjà jouées (le journal du club), le classement du matin et la cédule déjà connue,
 * rien d'avance ; l'écran, le moteur et les robots lisent le même.
 *
 *   n, jambes, pire, blesses[{ n, cle, m, total, genre, deja }], vedette, gardien, soirs, dos, visiteur, domicile, rival,
 *   bete, caisse, dernier { pour, contre, adv }, rang, equipes, retard, avance, dosRoute, masse { espace, libre, lourd, cap },
 *   defaites, serie, coach, puni, muet, pousse, chapeau, blanchissage, suites[{ de, choix, joueur, m, pts, butsDuo, resolue }],
 *   jalon, duo, recrue, veteran, murEnVue, coup, sejourFini, mandat,
 *   gros { adv, sorte, domicile, fiche, dernier, ancien, leurVedette, monMur, lancee, malades, partant }   (le matin du duel)
 *   ronde { k, adv, leurCoach, domicile, ficheSaison, precedente, meneur, gardien }                        (le matin du 1er match)
 *   vraie(cle)  → { buts, passes, gp, matchsDeSaSaison, clubs, enCours, victoires, arrets } : LA VRAIE SAISON AVEC SES BORNES
 *               (JP, 5 nov. 2026) ; `vraieMot(v)` la dit : « cette année-là, 34 buts en 47 matchs », « avec Boston » si
 *               `clubs === 1` seulement, « jusqu'ici » si la saison est en cours, jamais « a fini ».
 *
 * `run` : ce que la run sait et que le moteur ne porte pas — { jetons, masse, coach, mandat: { mot, top }, anciens (un Set
 * des clés laissées partir), sorties (les histoires sorties, { cle, choix, joueur, joueurs, j }), places (16), club(t),
 * shard(saison) } ; `series` : { k (la ronde, 1 = la première), s (ta série, { A, B, feuilles }), precedente } le matin du
 * premier match d'une ronde. Un joueur absent des faits : null.
 */
import { SLOTS, getPlayerKey, energieDe, jambesGardien, dosADos, rivalChoisi, joueursDeLaSaison } from './sim.js';
import { seasonGames, ageAtSeason } from './ratings.js';
import { joueurDuFait } from './vie-gm.js';
import { FILS } from './recit.js';
import { ADJOINTS } from './adjoints.js';
import { COACHS } from './coachs.js';
import { POUVOIRS } from './pouvoirs.js';
import { SEMAINE } from './inventaire.js';
import { money, ord, ordF } from './util.js';

/* Les faits d'un joueur se lisent sur ses FENETRE_JOUEUR derniers matchs ; la chicane, à PUNITIONS_CHICANE punitions. */
export const FENETRE_JOUEUR = 10, PUNITIONS_CHICANE = 4;
/* Le petit qui pousse : POINTS_PETIT points sur ses derniers matchs ; le duo : BUTS_DUO buts ensemble ; le vieux : AGE_VETERAN ans. */
const POINTS_PETIT = 4, BUTS_DUO = 5, AGE_VETERAN = 35;
/* Le gardien en vue du galon : de MUR_DE à MUR_A victoires (le galon 🏵 Le mur est à 30, js/galons.js). */
const MUR_DE = 26, MUR_A = 29;
/* Les primes au contrat : le 20e but, le 40e point, puis les crans des fils (`FILS.jalon`). */
const CRANS_JALON = { buts: [20, ...FILS.jalon.buts], points: [40, ...FILS.jalon.points] };
/* Le virus : un patineur sous MALADE de jambes le matin d'un gros match. */
const MALADE = 65;
/* Le classement : le même bris d'égalité que le classement final du moteur, puis le club (une saison reprise se rebâtit pareil). */
const classer = teams => teams.slice().sort((a, b) => (b.PTS || 0) - (a.PTS || 0) || (b.W || 0) - (a.W || 0)
  || ((b.GF || 0) - (b.GA || 0)) - ((a.GF || 0) - (a.GA || 0)) || (b.GF || 0) - (a.GF || 0)
  || String(`${a.tag}${a.season || ''}`).localeCompare(String(`${b.tag}${b.season || ''}`)));

/* La vraie saison d'un joueur, bornée : jamais un chiffre d'une autre époque, jamais « a fini ». */
function vraieDe(p, shard) {
  if (!p) return null;
  const sh = shard ? shard(p.s) : null;
  const memes = sh ? sh.players.filter(x => x.id != null && x.id === p.id) : (joueursDeLaSaison(p.s) || []).filter(x => x.id != null && x.id === p.id);
  const matchsDeSaSaison = seasonGames(p.s), club = sh && sh.an && sh.an[p.t];
  return {
    buts: p.p === 'G' ? null : p.g || 0, passes: p.p === 'G' ? null : p.a || 0, gp: p.gp || 0, matchsDeSaSaison,
    clubs: Math.max(1, memes.length), club: p.t || null, enCours: !!(club && club.gp < matchsDeSaSaison),
    victoires: p.p === 'G' ? p.w || 0 : null, arrets: p.p === 'G' && p.sv ? p.sv : null,
  };
}
/* Elle se dit d'un seul gabarit : « cette année-là, 34 buts en 47 matchs avec Boston », « jusqu'ici, ,931 en 40 matchs ». */
export function vraieMot(v, nomDuClub = null) {
  if (!v || !v.gp) return '';
  const avec = v.clubs === 1 && v.club ? ` avec ${nomDuClub ? nomDuClub(v.club) : v.club}` : '';
  const quand = v.enCours ? 'jusqu\'ici' : 'cette année-là';
  if (v.victoires != null) {
    const pct = v.arrets ? `, ${String(v.arrets.toFixed(3)).replace(/^0/, '')} d'efficacité` : '';
    return `${quand}, ${v.victoires} victoire${v.victoires > 1 ? 's' : ''} en ${v.gp} matchs${pct}${avec}`;
  }
  return `${quand}, ${v.buts} but${v.buts > 1 ? 's' : ''} en ${v.gp} matchs${avec}`;
}

export function faitsDe({ ligue, you, jour, run = {}, series = null }) {
  const club = run.club || (t => (t ? t.name || t.tag || '' : ''));
  const cle = getPlayerKey;
  const roster = Object.values(you.roster || {}).filter(Boolean);
  const parCle = new Map(roster.map(p => [cle(p), p]));
  const habilles = new Set(SLOTS.filter(sl => !sl.scratch).map(sl => you.roster[sl.i]).filter(Boolean));
  const patineurs = SLOTS.filter(sl => !sl.scratch && sl.group !== 'G').map(sl => ({ sl, p: you.roster[sl.i] })).filter(x => x.p);
  // LE JOURNAL, jusqu'à ce matin : rien d'avance (une saison reprise relit les mêmes feuilles).
  const journal = (you.journal || []).filter(e => e.feuille && (!Number.isFinite(e.jour) || e.jour < jour));
  const coteDe = (e, t = you) => (e.feuille.alignes && (e.feuille.alignes.A || []).some(p => Object.values(t.roster || {}).includes(p)) ? 'A' : 'B');
  const feuilles = journal.map(e => ({ e, f: e.feuille, cote: coteDe(e), j: e.jour }));
  const n = feuilles.length;
  const dernieres = feuilles.slice(-FENETRE_JOUEUR);
  const qui = p => ({ n: p.n, cle: cle(p) });
  const estDeMoi = (x, p) => ((x.f.alignes && x.f.alignes[x.cote]) || []).includes(p);
  const points = (x, p) => (x.f.buts || []).filter(b => b.cote === x.cote && !b.fusillade && (b.marqueur === p || (b.passeurs || []).includes(p))).length;
  const siens = (p, liste = feuilles) => liste.filter(x => estDeMoi(x, p));
  // LES JAMBES DU MATIN : l'instantané du jour (`jourLignes`), sinon ce que le joueur porte.
  const matin = ((you.jourLignes || [])[jour] || {}).energie || {};
  const jambesDe = p => Math.round(matin[cle(p)] ?? (p.p === 'G' ? jambesGardien(p) : energieDe(p)));
  const pats = patineurs.map(({ p }) => ({ ...qui(p), j: jambesDe(p) }));
  // LA SEMAINE, déjà connue : tes soirs, les visiteurs, les dos-à-dos, le rival et la bête noire.
  const monSoir = j => ((ligue && ligue.calendrier && ligue.calendrier[j]) || []).find(m => m.A === you || m.B === you) || null;
  const jours = []; for (let j = jour; j < jour + SEMAINE; j++) if (monSoir(j)) jours.push(j);
  const soirs = jours.map(monSoir), advs = soirs.map(m => (m.A === you ? m.B : m.A));
  const bete = advs.find(a => you.beteNoire === a) || null, rival = advs.find(a => a !== bete && rivalChoisi(you, a)) || null;
  // LE CLASSEMENT DU MATIN, la course aux séries et l'avance du premier.
  const teams = (ligue && ligue.teams) || [you];
  const ordre = classer(teams), rang = ordre.indexOf(you) + 1, places = run.places || 16;
  const pts = t => (t && t.PTS) || 0;
  const retard = rang > places ? Math.max(0, pts(ordre[places - 1]) - pts(you)) : 0;
  const avance = rang === 1 && ordre.length > 1 ? pts(you) - pts(ordre[1]) : null;
  // LE DERNIER MATCH, les séquences.
  const der = feuilles[n - 1] || null;
  const deSuite = ok => { let k = 0; for (let i = n - 1; i >= 0 && ok(feuilles[i].e); i--) k++; return k; };
  // QUI PORTE LA SEMAINE (V19) : ton meilleur pointeur des dix derniers, le gardien du dernier soir (`joueurDuFait`).
  const porte = sorte => { const x = joueurDuFait(sorte, dernieres.map(({ f, cote }) => ({ f, cote })), habilles); return x ? { ...qui(x.p), fait: x.fait, m: dernieres.length } : null; };
  const vedette0 = porte('vedette');
  const vedette = vedette0 ? { ...vedette0, pts: siens(parCle.get(vedette0.cle), dernieres).reduce((a, x) => a + points(x, parCle.get(vedette0.cle)), 0), sal: parCle.get(vedette0.cle).$ ? money(parCle.get(vedette0.cle).$) : null } : null;
  const gardien0 = porte('gardien');
  const gardien = gardien0 && der ? { ...gardien0, contre: (der.f.buts || []).filter(b => b.cote !== der.cote && !b.fusillade && b.gardien === parCle.get(gardien0.cle)).length } : gardien0;
  // LES FAITS D'UN JOUEUR (V11) : lus dans SES feuilles, ses dix derniers matchs habillé.
  const lus = patineurs.map(({ sl, p }) => {
    const s = siens(p).slice(-FENETRE_JOUEUR);
    return { sl, p, m: s.length, pts: s.reduce((a, x) => a + points(x, p), 0), pun: s.reduce((a, x) => a + (x.f.punitions || []).filter(y => y.cote === x.cote && y.joueur === p).length, 0) };
  });
  const ou = sl => (sl.group === 'D' ? `${ordF(sl.unit + 1)} paire` : `${ord(sl.unit + 1)} trio`);
  const puni = lus.filter(x => x.pun >= PUNITIONS_CHICANE).sort((a, b) => b.pun / b.m - a.pun / a.m)[0];
  const muet = [...lus].sort((a, b) => (b.p.$ || 0) - (a.p.$ || 0)).slice(0, 3).filter(x => x.m >= FENETRE_JOUEUR - 2 && x.pts <= 1).sort((a, b) => a.pts - b.pts || (b.p.$ || 0) - (a.p.$ || 0))[0];
  const pousse = lus.filter(x => x.sl.group === 'F' && x.sl.unit >= 2 && x.m >= 5 && x.pts >= POINTS_PETIT).sort((a, b) => b.pts - a.pts)[0];
  // LE DUO : deux avants du même trio, BUTS_DUO buts de l'un sur passe de l'autre dans les dix derniers.
  let duo = null;
  for (const a of patineurs.filter(x => x.sl.group === 'F')) for (const b of patineurs.filter(x => x.sl.group === 'F' && x.sl.unit === a.sl.unit && x.p !== a.p)) {
    const s = siens(a.p, dernieres);
    const buts = s.reduce((k, x) => k + (x.f.buts || []).filter(y => y.cote === x.cote && !y.fusillade && y.marqueur === a.p && (y.passeurs || []).includes(b.p)).length, 0);
    if (buts >= BUTS_DUO && (!duo || buts > duo.buts)) duo = { marqueur: qui(a.p), passeur: qui(b.p), buts, m: s.length };
  }
  // LA RECRUE au rythme du fil (`FILS.recrue`), LE VIEUX par l'âge dans sa saison (JP, C0 q. 8), sur leurs matchs chez toi.
  const chezToi = p => { const s = siens(p); return { m: s.length, pts: s.reduce((a, x) => a + points(x, p), 0) }; };
  const recrue = patineurs.map(({ p }) => ({ p, ...chezToi(p) })).filter(x => x.p.rk && x.m >= FILS.recrue.matchs && x.pts / x.m >= FILS.recrue.rythme).sort((a, b) => b.pts - a.pts)[0];
  const veteran = patineurs.map(({ p }) => ({ p, age: ageAtSeason(p.bd, p.s), ...chezToi(p) })).filter(x => x.age >= AGE_VETERAN && x.m >= FENETRE_JOUEUR).sort((a, b) => b.age - a.age)[0];
  // LA PRIME AU CONTRAT : un cran passé cette semaine (ses buts ou ses points chez toi, dans l'ordre des feuilles).
  let jalon = null;
  for (const { p } of patineurs) {
    let g = 0, pt = 0;
    for (const x of siens(p)) {
      const b = (x.f.buts || []).filter(y => y.cote === x.cote && !y.fusillade && y.marqueur === p).length, a = points(x, p);
      const recent = Number.isFinite(x.j) && x.j >= jour - SEMAINE;
      const passe = (crans, avant, apres) => crans.find(c => avant < c && apres >= c);
      const cb = passe(CRANS_JALON.buts, g, g + b), cp = passe(CRANS_JALON.points, pt, pt + a);
      g += b; pt += a;
      if (recent && (cb || cp) && (!jalon || (cb || cp) > jalon.total)) jalon = { ...qui(p), quoi: cb ? 'buts' : 'points', total: cb || cp, m: x.e.n, sal: p.$ ? money(p.$) : null };
    }
  }
  // LE MUR EN VUE : ton gardien à MUR_DE..MUR_A victoires chez toi (compté comme js/galons.js : un match gagné, son gardien).
  const gardiens = SLOTS.filter(sl => sl.group === 'G' && !sl.scratch).map(sl => you.roster[sl.i]).filter(Boolean);
  const murEnVue = gardiens.map(g => ({ g, v: feuilles.filter(x => x.e.win && x.e.gardien === g).length, departs: feuilles.filter(x => x.e.gardien === g).length }))
    .filter(x => x.v >= MUR_DE && x.v <= MUR_A).map(x => ({ ...qui(x.g), v: x.v, departs: x.departs }))[0] || null;
  // LE COUP : une bagarre ou une mêlée d'hier soir (la majeure de `physique`), ton joueur.
  const bagarre = der ? (der.f.physique || []).find(x => x.type === 'bagarre' && (x.minutes || 0) >= 5 && (habilles.has(x.joueur) || habilles.has(x.cible))) : null;
  const coup = bagarre ? { ...qui(habilles.has(bagarre.joueur) ? bagarre.joueur : bagarre.cible), min: bagarre.minutes, adv: club(der.e.adv) } : null;
  // CE QUE LE DERNIER MATCH LAISSE (V23) : un tour du chapeau, le blanchissage d'un gardien qui n'est pas ton partant.
  const partant = you.roster[SLOTS.find(sl => sl.group === 'G').i] || null;
  let chapeau = null, blanchissage = null;
  if (der) {
    const parBut = new Map();
    for (const b of der.f.buts || []) if (b.cote === der.cote && !b.fusillade && b.marqueur) parBut.set(b.marqueur, (parBut.get(b.marqueur) || 0) + 1);
    const [p, buts] = [...parBut.entries()].find(([, k]) => k >= 3) || [];
    if (p) chapeau = { ...qui(p), buts };
    const g = der.cote === 'A' ? der.f.gardienA : der.f.gardienB;
    if (g && der.e.ga === 0 && g !== partant) blanchissage = qui(g);
  }
  // LES BLESSÉS À CE JOUR (on ne révèle que ce qui est arrivé) : leurs matchs restants, la blessure entière, son genre, ses commotions d'avant.
  const blesses = [];
  for (const b of you.injuriesLog || []) {
    const reste = b.at + b.games - (n + 1);
    if (reste <= 0 || !b.player || (you.injuriesLog || []).some(c => c !== b && c.player === b.player && c.at > b.at)) continue;
    const deja = (you.injuriesLog || []).filter(c => c !== b && c.player === b.player && c.genre === 'commotion' && c.at < b.at).length + ((you.commotions && you.commotions[cle(b.player)]) || 0);
    blesses.push({ ...qui(b.player), m: reste, total: b.games, genre: b.genre || null, deja });
  }
  blesses.sort((a, b) => b.m - a.m);
  // LES SUITES (V23) : pour chaque histoire sortie, ce que son joueur a fait DEPUIS, dans ses feuilles ; résolue quand une
  // histoire plus récente l'a nommé (jamais deux fois le même joueur dans la saison : c'est son épisode 2).
  const suites = [];
  for (const d of run.sorties || []) {
    const p = parCle.get(d.joueur);
    if (!p || !Number.isFinite(d.j)) continue;
    const depuis = siens(p).filter(x => Number.isFinite(x.j) && x.j >= d.j);
    const passeur = d.joueurs && d.joueurs[1] ? parCle.get(d.joueurs[1]) : null;
    suites.push({ de: d.cle, choix: d.choix, joueur: qui(p), m: depuis.length, pts: depuis.reduce((a, x) => a + points(x, p), 0),
      butsDuo: passeur ? depuis.reduce((a, x) => a + (x.f.buts || []).filter(y => y.cote === x.cote && !y.fusillade && y.marqueur === p && (y.passeurs || []).includes(passeur)).length, 0) : 0,
      resolue: (run.sorties || []).some(y => y !== d && y.j > d.j && y.joueur === d.joueur) });
  }
  // LA FIN D'UN SÉJOUR (V22) de la semaine : la carte, sa fiche.
  const sej = (you.sejoursFinis || []).filter(x => Number.isFinite(x.jour) && x.jour < jour && x.jour >= jour - SEMAINE).at(-1) || null;
  const sejourFini = sej && ADJOINTS[sej.cle] ? { cle: sej.cle, nom: ADJOINTS[sej.cle].nom, ico: ADJOINTS[sej.cle].ico, v: sej.v, d: sej.d, dp: sej.dp, matchs: sej.fin - sej.debut } : null;
  const shard = run.shard || null;
  const vraie = k => vraieDe(parCle.get(k) || (gros0 && gros0.adv && Object.values(gros0.adv.roster || {}).find(p => p && cle(p) === k)) || null, shard);
  // LE GROS MATCH DE CE MATIN (jamais la veille) : joué, il est dans `minisBoss` ; à venir, le moteur l'a annoncé (`grosAnnonces`).
  const gros0 = (you.minisBoss || []).find(x => x.jour === jour) || (ligue && ligue.grosAnnonces && ligue.grosAnnonces[jour]) || null;
  let gros = null;
  if (gros0 && gros0.adv && monSoir(jour)) {
    const adv = gros0.adv, leurs = (adv.journal || []).filter(e => e.feuille && (!Number.isFinite(e.jour) || e.jour < jour)).slice(-FENETRE_JOUEUR).map(e => ({ f: e.feuille, cote: coteDe(e, adv) }));
    const leurRoster = new Set(Object.values(adv.roster || {}).filter(Boolean));
    const contre = feuilles.filter(x => x.e.adv === adv);
    const lv = joueurDuFait('vedette', leurs, leurRoster);
    const ancienP = [...leurRoster].find(p => run.anciens && run.anciens.has(cle(p))) || null;
    const ancienPts = ancienP ? leurs.filter(x => ((x.f.alignes && x.f.alignes[x.cote]) || []).includes(ancienP)) : [];
    const defenseurs = patineurs.filter(x => x.sl.group === 'D').map(x => x.p).sort((a, b) => (b.simPM || 0) - (a.simPM || 0));
    gros = {
      adv: club(adv), sorte: gros0.raison || null, domicile: monSoir(jour).A === you,
      fiche: { v: contre.filter(x => x.e.win).length, d: contre.filter(x => !x.e.win).length },
      dernier: contre.length ? { pour: contre.at(-1).e.gf, contre: contre.at(-1).e.ga } : null,
      ancien: ancienP ? { n: ancienP.n, cle: cle(ancienP), pts: ancienPts.reduce((a, x) => a + points(x, ancienP), 0), m: ancienPts.length, vraie: vraieDe(ancienP, shard) } : null,
      leurVedette: lv ? { n: lv.p.n, pts: lv.pts, m: leurs.length, vraie: vraieDe(lv.p, shard) } : null,
      monMur: defenseurs[0] ? { ...qui(defenseurs[0]), pm: defenseurs[0].simPM || 0 } : null,
      lancee: deSuite(e => e.win),
      malades: pats.filter(x => x.j < MALADE).sort((a, b) => a.j - b.j),
      partant: partant ? { ...qui(partant), j: jambesDe(partant), dosADos: dosADos(you, jour) } : null,
    };
  }
  // LA RONDE (le matin du premier match) : leur coach, la fiche de saison contre eux, la ronde d'avant, ton meneur et ton gardien des séries.
  let ronde = null;
  if (series && series.s) {
    const s = series.s, adv = s.A === you ? s.B : s.A, perso = adv.perso || adv.persoSeries;
    const P = perso && POUVOIRS[perso.cle] ? POUVOIRS[perso.cle][0] : null;
    const contre = feuilles.filter(x => x.e.adv === adv);
    const po = p => (p && p.po) || {};
    const meneur = patineurs.map(x => x.p).filter(p => (po(p).PTS || 0) > 0).sort((a, b) => (po(b).PTS || 0) - (po(a).PTS || 0))[0] || null;
    ronde = {
      k: series.k, adv: club(adv), domicile: s.A === you,
      leurCoach: perso && COACHS[perso.cle] ? { nom: COACHS[perso.cle].nom, ico: COACHS[perso.cle].ico, pouvoir: P ? P.nom : '' } : null,
      ficheSaison: { v: contre.filter(x => x.e.win).length, d: contre.filter(x => !x.e.win).length },
      precedente: series.precedente ? { matchs: (series.precedente.feuilles || []).length } : null,
      meneur: meneur ? { ...qui(meneur), pts: po(meneur).PTS || 0, m: po(meneur).GP || 0, vraie: vraieDe(meneur, shard) } : null,
      gardien: partant ? { ...qui(partant), pctArr: po(partant).SA ? 1 - (po(partant).GA || 0) / po(partant).SA : null, departs: po(partant).GP || 0 } : null,
    };
  }
  return {
    jour, n, jambes: pats.length ? Math.round(pats.reduce((a, x) => a + x.j, 0) / pats.length) : 100,
    pire: pats.reduce((b, x) => (!b || x.j < b.j ? x : b), null),
    blesses, vedette, gardien,
    soirs: soirs.length, dos: jours.filter(j => dosADos(you, j)).length,
    visiteur: soirs.filter(m => m.B === you).length, domicile: soirs.filter(m => m.A === you).length,
    rival: rival ? club(rival) : null, bete: bete ? club(bete) : null,
    caisse: run.jetons ?? null,
    dernier: der ? { pour: der.e.gf, contre: der.e.ga, adv: club(der.e.adv) } : null,
    rang, equipes: teams.length, retard, avance,
    dosRoute: jours.filter(j => dosADos(you, j) && monSoir(j).B === you && monSoir(j - 1) && monSoir(j - 1).B === you).length,
    masse: run.masse || null, defaites: deSuite(e => !e.win), serie: deSuite(e => e.win), coach: run.coach || null,
    puni: puni ? { ...qui(puni.p), m: puni.m, pun: puni.pun } : null,
    muet: muet ? { ...qui(muet.p), m: muet.m, sal: money(muet.p.$ || 0), pts: muet.pts } : null,
    pousse: pousse ? { ...qui(pousse.p), m: pousse.m, pts: pousse.pts, ou: ou(pousse.sl) } : null,
    chapeau, blanchissage, suites,
    jalon, duo,
    recrue: recrue ? { ...qui(recrue.p), pts: recrue.pts, m: recrue.m } : null,
    veteran: veteran ? { ...qui(veteran.p), age: veteran.age, pts: veteran.pts, m: veteran.m } : null,
    murEnVue, coup, sejourFini,
    mandat: run.mandat ? { mot: run.mandat.mot, rang: run.mandat.top ?? null } : null,
    gros, ronde, vraie,
  };
}
