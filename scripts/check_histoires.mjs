/*
 * LES HISTOIRES (V25 C1, docs/refonte-v25-c1.md ; js/histoires.js, js/faits.js). Une seule banque, trois moments, un tirage.
 * Ce qu'on exige :
 *   1. la forme : quarante histoires, 28 au lundi, 6 au gros match, 6 à la ronde ; chacune une voix d'`EXPEDITEURS`, un
 *      titre, une icône, une famille, `quand`, `joueur`, `fait` et `mots` (des fonctions), deux options nommées, chacune un
 *      niveau (rien au-dessus de Pilier, JP, C0 q. 9) et un effet de la grammaire (js/effets.js : ses dix cases, rien
 *      d'autre), jamais vide ; les gestes connus ; ce qui va au joueur sur ses canaux à lui, avec une durée ; le dé
 *      (`pari`) à deux issues `{ duree, lui }`, sa chance en sixièmes ; les canaux du club aux moments `gros` et `ronde`
 *      seulement (C0 q. 4) ; les jetons et l'expérience jamais dans une issue ; six rares (C0 q. 7) ; une suite nomme son
 *      épisode 1 ; chaque voix d'`EXPEDITEURS` porte une histoire au moins ;
 *   2. la réplique NOMME (C0 q. 1) : sur des faits fabriqués où chaque histoire est vraie, `sceneDe` rend la voix, une
 *      réplique qui dit le nom court du joueur nommé et ne dit que des nombres reçus (le chiffre du fait, jamais une stat
 *      du moteur), et un fait qui nomme le joueur et porte un nombre ; aucune accolade oubliée ;
 *   3. le tirage, pur : la même graine, le même moment et les mêmes faits rendent la même histoire, toujours une vraie, et
 *      rien quand rien n'est vrai (le rythme du lundi, un lundi sur deux, est parti avec la saison de 82 soirs : V28,
 *      tranche 4) ; jamais
 *      pendant son repos (`REPOS_HISTOIRE` semaines) ni sur un joueur qu'elle a déjà nommé, `SORTIES_MAX` fois par saison au
 *      plus, et elle revient ; une rare par saison ; chaque moment a son pool ; une suite passe avant le tirage ;
 *   3b. la mémoire de la run (V25 C2) : d'une saison à l'autre, jamais la même histoire sur le même joueur ; elle revient
 *      sur un autre, et la rare de la saison d'avant ne retient pas celle-ci ;
 *   4. chacune s'ouvre : sur des lundis, des matins de gros match et des rondes fabriqués, chaque histoire sort.
 *   node scripts/check_histoires.mjs
 */
import { HISTOIRES, MOMENTS, tirer, sceneDe, nomDOption, memoireDeLaRun, REPOS_HISTOIRE, SORTIES_MAX, CHANCE_RARE } from '../js/histoires.js';
import { EXPEDITEURS } from '../js/vie-gm.js';
import { CASES, GESTES, CANAUX_LUI, estVide } from '../js/effets.js';
import { nomCourt } from '../js/recit.js';
import { MOMENTS_SI } from '../js/sim.js';
import { SEMAINE } from '../js/util.js';
import { exiger, informer, verdict } from './verdict.mjs';

const cles = Object.keys(HISTOIRES);
const parMoment = m => cles.filter(k => HISTOIRES[k].moment === m);

/* ---------- 1. la forme ---------- */
{
  const voix = new Set(Object.keys(EXPEDITEURS));
  const CHAMPS = new Set(['cle', 'nom', 'niveau', ...CASES]), ACTIONS = new Set(GESTES), LUI = new Set(CANAUX_LUI);
  const fautes = [];
  for (const [k, H] of Object.entries(HISTOIRES)) {
    if (!voix.has(H.de)) fautes.push(`${k} : la voix ${H.de}`);
    if (!H.titre || !H.ico || !H.famille || !MOMENTS.includes(H.moment)) fautes.push(`${k} : titre, icône, famille ou moment`);
    for (const f of ['quand', 'joueur', 'fait', 'mots']) if (typeof H[f] !== 'function') fautes.push(`${k} : ${f} n'est pas une fonction`);
    if (H.suiteDe && !HISTOIRES[H.suiteDe]) fautes.push(`${k} : la suite de ${H.suiteDe}, qui n'existe pas`);
    if (!Array.isArray(H.options) || H.options.length !== 2) fautes.push(`${k} : ${(H.options || []).length} réponses`);
    for (const o of H.options || []) {
      const id = `${k}/${o.cle}`;
      if (!o.cle || !o.nom) fautes.push(`${id} : un nom`);
      if (!Number.isInteger(o.niveau) || o.niveau < 0 || o.niveau > 2) fautes.push(`${id} : le niveau ${o.niveau} (0 à 2)`);
      const inconnus = Object.keys(o).filter(c => !CHAMPS.has(c));
      if (inconnus.length) fautes.push(`${id} : ${inconnus.join(', ')}`);
      if (estVide(o)) fautes.push(`${id} : ne fait rien de concret`);
      if (o.gestes && Object.keys(o.gestes).some(g => !ACTIONS.has(g))) fautes.push(`${id} : le geste`);
      if (o.lui && (!o.duree || Object.keys(o.lui).some(c => !LUI.has(c)))) fautes.push(`${id} : ce qui va au joueur`);
      if (o.duree && !o.lui && !o.canaux) fautes.push(`${id} : une durée sans joueur ni canaux`);
      if (o.canaux && H.moment === 'lundi') fautes.push(`${id} : des canaux du club au lundi`);
      if (o.adv) fautes.push(`${id} : des canaux sur l'adversaire`);
      if (o.pari) {
        const issues = [o.pari.gagne, o.pari.perd], c6 = o.pari.chance * 6;
        if (Math.abs(c6 - Math.round(c6)) > 1e-9 || c6 < 1 || c6 > 5) fautes.push(`${id} : la chance ${o.pari.chance} n'est pas en sixièmes`);
        if (issues.some(e => !e || !e.duree || !e.lui || Object.keys(e).some(c => !['duree', 'lui'].includes(c)) || Object.keys(e.lui).some(c => !LUI.has(c)))) fautes.push(`${id} : l'audace (deux issues { duree, lui })`);
      }
      if (o.quand && !MOMENTS_SI[o.quand]) fautes.push(`${id} : le moment ${o.quand}`);
    }
  }
  exiger('quarante histoires : 28 au lundi, 6 au gros match, 6 à la ronde', cles.length === 40 && parMoment('lundi').length === 28 && parMoment('gros').length === 6 && parMoment('ronde').length === 6,
    `${cles.length} : ${MOMENTS.map(m => `${m} ${parMoment(m).length}`).join(' · ')}`);
  exiger('chaque histoire a sa voix, son moment, ses fonctions et deux cartes dans la grammaire, rien au-dessus de Pilier, les canaux du club hors du lundi', !fautes.length, fautes.slice(0, 5).join(' · ') || `${cles.length} histoires`);
  const rares = cles.filter(k => HISTOIRES[k].rare);
  exiger('six rares (JP, C0 q. 7)', rares.length === 6, rares.join(', '));
  const muettes = Object.keys(EXPEDITEURS).filter(v => !cles.some(k => HISTOIRES[k].de === v));
  exiger('chaque voix porte une histoire au moins', !muettes.length, muettes.join(', ') || `${Object.keys(EXPEDITEURS).length} voix`);
}

/* ---------- des faits fabriqués, où tout est vrai ---------- */
const J = (n, cle, x = {}) => ({ n, cle, ...x });
const VRAIES = { lv: { buts: 56, passes: 80, gp: 80, matchsDeSaSaison: 80, clubs: 1, club: 'Montréal', enCours: false, victoires: null, arrets: null },
  lg: { buts: null, passes: null, gp: 54, matchsDeSaSaison: 82, clubs: 1, club: 'Montréal', enCours: false, victoires: 33, arrets: 0.914 } };
const plein = (jour = 70, { gros = true, ronde = true } = {}) => ({
  jour, n: 55, jambes: 84, pire: J('Larry Robinson', 'lb', { j: 66 }),
  vedette: J('Guy Lafleur', 'lv', { fait: 'Guy Lafleur : 14 points en 10 matchs', pts: 14, m: 10, sal: '3,0 M$' }),
  gardien: J('Ken Dryden', 'lg', { fait: 'Ken Dryden : 6 buts sur 31 tirs ce soir-là', m: 10, contre: 6 }),
  puni: J('Tie Domi', 'pn', { pun: 5, m: 9 }), muet: J('Pavel Bure', 'mt', { sal: '7,5 M$', pts: 1, m: 10 }), pousse: J('Mario Lemieux', 'pt', { pts: 5, m: 7, ou: '3e trio' }),
  blesses: [J('Eric Lindros', 'bl', { m: 9, total: 14, genre: 'commotion', deja: 1 }), J('Joe Sakic', 'sk', { m: 4, total: 9, genre: 'aine', deja: 0 })],
  soirs: 4, dos: 1, visiteur: 3, domicile: 1, rival: 'Boston', bete: 'Québec', caisse: 60,
  dernier: { pour: 2, contre: 6, adv: 'Boston' }, rang: 1, equipes: 32, retard: 11, avance: 6, dosRoute: 1,
  masse: { espace: 400_000, libre: '0,4 M$', cap: 60_000_000, lourd: J('Eric Lindros', 'bl', { sal: '8,5 M$' }) }, defaites: 0, serie: 6, coach: { cle: 'tortue', nom: 'La Tortue', ico: '🐢', niveau: 2 },
  chapeau: J('Mike Bossy', 'bo', { buts: 3 }), blanchissage: J('Jeff Hackett', 'ha'),
  suites: [{ de: 'lePetit', choix: 'monter', joueur: J('Mario Lemieux', 'pt'), m: 8, pts: 7, butsDuo: 0, resolue: false }, { de: 'leDuo', choix: 'souder', joueur: J('Brett Hull', 'hu'), m: 10, pts: 12, butsDuo: 7, resolue: false }],
  jalon: J('Jari Kurri', 'ku', { quoi: 'buts', total: 20, m: 38, sal: '4,2 M$' }), duo: { marqueur: J('Brett Hull', 'hu'), passeur: J('Adam Oates', 'oa'), buts: 6, m: 10 },
  recrue: J('Teemu Selänne', 'se', { pts: 9, m: 12 }), veteran: J('Gordie Howe', 'ho', { age: 41, pts: 7, m: 10 }), murEnVue: J('Ken Dryden', 'lg', { v: 28, departs: 46 }),
  coup: J('Tie Domi', 'pn', { min: 5, adv: 'Boston' }), pieceChaude: { cle: 'canonnier', nom: 'Le canonnier', ico: '🏹', m: 7, v: 5, d: 2 },
  mandat: { mot: 'finir dans les dix premiers', rang: 10 },
  gros: gros ? { adv: 'Québec', sorte: 'nemesis', domicile: true, fiche: { v: 0, d: 2 }, dernier: { pour: 1, contre: 3 }, ancien: J('Dale Hunter', 'hu2', { pts: 9, m: 12, vraie: VRAIES.lv }),
    leurVedette: { n: 'Wayne Gretzky', pts: 21, m: 10, vraie: VRAIES.lv }, monMur: J('Rod Langway', 'la', { pm: 6 }), lancee: 4,
    malades: [J('Mario Lemieux', 'pt', { j: 58 }), J('Jaromir Jagr', 'ja', { j: 62 }), J('Ron Francis', 'fr', { j: 64 })], partant: J('Ken Dryden', 'lg', { j: 72, dosADos: true }) } : null,
  ronde: ronde ? { k: 2, adv: 'Edmonton', domicile: true, leurCoach: { nom: 'Le Frelon', ico: '🐝', pouvoir: 'La ruée' }, ficheSaison: { v: 1, d: 3 }, precedente: { matchs: 7 },
    meneur: J('Guy Lafleur', 'lv', { pts: 11, m: 6, vraie: VRAIES.lv }), gardien: J('Ken Dryden', 'lg', { pctArr: 0.931, departs: 5 }) } : null,
  vraie: cle => VRAIES[cle] || null,
});
const F = plein();

/* ---------- 2. la réplique nomme, et ne dit que ses chiffres ---------- */
{
  const fautes = [];
  let n = 0;
  // Ce qu'une histoire exige des faits pleins qui contredit une autre : le petit qui doute, le séjour raté, le mandat (ni premier ni au fond), la première ronde.
  const VARIANTES = { lePetitDoute: { suites: [{ ...F.suites[0], pts: 1 }] }, laPieceQuiRate: { pieceChaude: { ...F.pieceChaude, v: 2, d: 5 } }, leMandat: { rang: 13, retard: 0 }, lesBillets: { ronde: { ...F.ronde, k: 1 } } };
  for (const [k, H] of Object.entries(HISTOIRES)) {
    const f = { ...F, ...(VARIANTES[k] || {}) };
    const recus = new Set([...JSON.stringify(f).match(/\d+/g), '30', '2']);   // le trentième (le galon), « sa deuxième commotion »
    if (!H.quand(f)) { fautes.push(`${k} : fausse sur les faits pleins`); continue; }
    const j = H.joueur(f), sc = sceneDe(k, f);
    n++;
    if (!j || !j.n || !j.cle) { fautes.push(`${k} : aucun joueur`); continue; }
    if (!Object.values(EXPEDITEURS).includes(sc.de)) fautes.push(`${k} : la voix`);
    if (!sc.mot || /[{}]|undefined|null|NaN/.test(sc.mot) || !sc.mot.includes(nomCourt(j.n))) fautes.push(`${k} : la réplique ne nomme pas ${nomCourt(j.n)} (« ${sc.mot} »)`);
    for (const x of sc.mot.match(/\d+/g) || []) if (!recus.has(x)) fautes.push(`${k} : la réplique dit ${x}, un nombre qu'elle n'a pas reçu`);
    if (!sc.fait || /[{}]|undefined|null|NaN/.test(sc.fait) || !sc.fait.includes(j.n) || !/\d/.test(sc.fait)) fautes.push(`${k} : le fait « ${sc.fait} »`);
    for (const x of sc.fait.match(/\d+/g) || []) if (!recus.has(x)) fautes.push(`${k} : le fait dit ${x}, un nombre qu'il n'a pas reçu`);
    for (const o of H.options) if (/[{}]/.test(nomDOption(o, j))) fautes.push(`${k}/${o.cle} : « ${nomDOption(o, j)} »`);
  }
  exiger('chaque réplique nomme le joueur et ne dit que le chiffre du fait ; le fait le nomme et porte ses nombres', !fautes.length && n === cles.length, fautes.slice(0, 5).join(' · ') || `${n} scènes`);
  informer('deux scènes', ['leMuet', 'leurVedette'].map(k => { const s = sceneDe(k, F); return `${s.de.nom} : « ${s.mot} » — ${s.fait}`; }).join(' | '));
}

/* ---------- 3. le tirage ---------- */
{
  // Des matins fabriqués : chaque fait balaie ses valeurs, sur une graine qui ne se répète pas.
  let x = 7;
  const r = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pige = a => a[Math.floor(r() * a.length)];
  const peutEtre = (p, v) => (r() < p ? v : null);
  const matin = (jour, moment) => {
    const f = plein(jour, { gros: moment === 'gros', ronde: moment === 'ronde' });
    const n = pige([6, 14, 28, 44, 52, 60, 70]);
    const noms = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
    const q = cle => J(pige(noms), cle);
    return { ...f, n, rang: pige([1, 5, 16, 30]), retard: pige([0, 0, 9]), avance: pige([null, 3]), serie: pige([0, 2, 6]),
      vedette: peutEtre(0.8, { ...f.vedette, ...q('v' + pige([1, 2, 3])) }), gardien: peutEtre(0.6, f.gardien), puni: peutEtre(0.2, { ...f.puni, ...q('p' + pige([1, 2])) }),
      muet: peutEtre(0.15, { ...f.muet, ...q('m' + pige([1, 2])) }), pousse: peutEtre(0.3, { ...f.pousse, ...q('t' + pige([1, 2])) }), blesses: r() < 0.4 ? f.blesses : [],
      visiteur: pige([0, 1, 3]), dosRoute: pige([0, 0, 1]), chapeau: peutEtre(0.1, f.chapeau), blanchissage: peutEtre(0.1, f.blanchissage),
      suites: r() < 0.25 ? [{ ...f.suites[0], pts: pige([1, 7]) }, f.suites[1]] : [], jalon: peutEtre(0.1, f.jalon), duo: peutEtre(0.15, f.duo), recrue: peutEtre(0.1, f.recrue), veteran: peutEtre(0.15, f.veteran),
      murEnVue: peutEtre(0.08, f.murEnVue), coup: peutEtre(0.1, f.coup), pieceChaude: peutEtre(0.2, pige([f.pieceChaude, { ...f.pieceChaude, v: 2, d: 5 }])),
      masse: r() < 0.3 ? f.masse : { ...f.masse, espace: 9_000_000 }, mandat: f.mandat,
      ...(moment === 'gros' ? { gros: { ...f.gros, sorte: pige(['choisi', 'nemesis']), ancien: peutEtre(0.3, f.gros.ancien), leurVedette: peutEtre(0.7, f.gros.leurVedette), lancee: pige([0, 1, 4]), malades: r() < 0.3 ? f.gros.malades : [], partant: { ...f.gros.partant, j: pige([70, 90]), dosADos: r() < 0.3 } } } : {}),
      ...(moment === 'ronde' ? { ronde: { ...f.ronde, k: pige([1, 2, 3]), ficheSaison: pige([{ v: 1, d: 3 }, { v: 2, d: 1 }]), precedente: pige([{ matchs: 4 }, { matchs: 7 }]), meneur: peutEtre(0.7, f.ronde.meneur), leurCoach: peutEtre(0.8, f.ronde.leurCoach) } } : {}) };
  };
  // Au repos : sortie SORTIES_MAX fois, ou il y a REPOS_HISTOIRE semaines ou moins, ou sur ce joueur-là déjà ; hors du lundi, jamais deux fois.
  const auRepos = (k, f, sorties) => { const H = HISTOIRES[k], lui = H.joueur(f), s = sorties.filter(x => x.cle === k); return (H.moment !== 'lundi' && s.length > 0) || s.length >= SORTIES_MAX || s.some(x => f.jour - x.j <= REPOS_HISTOIRE * SEMAINE || x.joueur === lui.cle); };
  const vraies = (moment, f, sorties) => cles.filter(k => HISTOIRES[k].moment === moment && HISTOIRES[k].quand(f) && HISTOIRES[k].joueur(f) && !auRepos(k, f, sorties));
  let purs = true, vrai = true, nul = true, repos = true, memeJoueur = 0, revenus = 0, raresParSaison = 0, suitesAvant = true, poolsSepares = true;
  const sortis = new Map();
  for (let g = 0; g < 300; g++) {
    const sorties = [];
    let rares = 0;
    for (let w = 1; w < 26; w++) {
      const jour = w * SEMAINE;
      const f = matin(jour, 'lundi');
      const a = tirer(g, 'lundi', f, sorties), b = tirer(g, 'lundi', f, sorties.slice());
      if (a !== b) purs = false;
      const possibles = vraies('lundi', f, sorties);
      if (!possibles.length && a) nul = false;
      if (!a) continue;
      if (!HISTOIRES[a].quand(f)) vrai = false;
      const lui = HISTOIRES[a].joueur(f);
      const siennes = sorties.filter(s => s.cle === a);
      if (siennes.length >= SORTIES_MAX || siennes.some(s => jour - s.j <= REPOS_HISTOIRE * SEMAINE)) repos = false;
      if (siennes.length) revenus++;
      if (siennes.some(s => s.joueur === lui.cle)) memeJoueur++;
      if (possibles.some(k => HISTOIRES[k].suiteDe) && !HISTOIRES[a].suiteDe) suitesAvant = false;
      if (HISTOIRES[a].rare) rares++;
      sorties.push({ cle: a, choix: HISTOIRES[a].options[0].cle, joueur: lui.cle, joueurs: [lui.cle], j: jour });
      sortis.set(a, (sortis.get(a) || 0) + 1);
    }
    if (rares > 1) raresParSaison++;
    // Le gros match et la ronde : leur pool, jamais deux fois la même, et le lundi ne les vide pas.
    for (const [moment, jours] of [['gros', [30, 44, 58, 72]], ['ronde', [190, 191, 192]]]) {
      for (const jour of jours) {
        const f = matin(jour, moment);
        const a = tirer(g, moment, f, sorties);
        if (!a) continue;
        if (HISTOIRES[a].moment !== moment) poolsSepares = false;
        if (sorties.some(s => s.cle === a)) repos = false;
        sorties.push({ cle: a, choix: HISTOIRES[a].options[0].cle, joueur: HISTOIRES[a].joueur(f).cle, joueurs: [], j: jour });
        sortis.set(a, (sortis.get(a) || 0) + 1);
      }
    }
  }
  exiger('pur : la même graine, le même moment et les mêmes faits rendent la même histoire', purs);
  exiger('l\'histoire rendue est toujours vraie ; rien de vrai : null', vrai && nul);
  exiger(`jamais pendant son repos (${REPOS_HISTOIRE} semaines), ${SORTIES_MAX} fois par saison au plus, jamais deux fois la même au gros match ou à la ronde, et elle revient`, repos && revenus > 0, `${revenus} retours sur 300 saisons`);
  exiger('jamais la même histoire sur le même joueur', memeJoueur === 0, `${memeJoueur} fois`);
  exiger(`une rare par saison au plus (${CHANCE_RARE} de chance à son tirage)`, raresParSaison === 0, `${raresParSaison} saisons à deux rares`);
  exiger('une suite passe avant le tirage', suitesAvant);
  exiger('chaque moment a son pool', poolsSepares);
  /*
   * 3b. LA MÉMOIRE DE LA RUN (V25 C2, `memoireDeLaRun`) : une deuxième saison, tirée avec les histoires de la première, ne
   * revoit jamais une histoire sur un joueur qu'elle a déjà nommé ; elle la revoit sur un autre, et une rare de la saison
   * d'avant n'empêche pas celle de cette saison (le repos, les sorties et la rare se comptent à la saison).
   */
  let redites = 0, reprises = 0, raresDeuxieme = 0;
  for (let g = 0; g < 300; g++) {
    const premiere = [];
    for (let w = 1; w < 26; w++) {
      const f = matin(w * SEMAINE, 'lundi'), a = tirer(`r${g}`, 'lundi', f, premiere);
      if (a) premiere.push({ cle: a, choix: HISTOIRES[a].options[0].cle, joueur: HISTOIRES[a].joueur(f).cle, joueurs: [], j: w * SEMAINE });
    }
    const memoire = memoireDeLaRun([], premiere), deuxieme = [];
    for (let w = 1; w < 26; w++) {
      const f = matin(w * SEMAINE, 'lundi'), a = tirer(`r${g}:s2`, 'lundi', f, [...memoire, ...deuxieme]);
      if (!a) continue;
      const lui = HISTOIRES[a].joueur(f).cle;
      if (memoire.some(x => x.cle === a && x.joueur === lui)) redites++;
      else if (memoire.some(x => x.cle === a)) reprises++;
      if (HISTOIRES[a].rare && memoire.some(x => HISTOIRES[x.cle].rare)) raresDeuxieme++;
      deuxieme.push({ cle: a, choix: HISTOIRES[a].options[0].cle, joueur: lui, joueurs: [], j: w * SEMAINE });
    }
  }
  exiger('la run ne revoit jamais une histoire sur le même joueur, d\'une saison à l\'autre', redites === 0, `${redites} redites sur 300 runs de deux saisons`);
  exiger('la mémoire de la run ne bloque que le joueur : l\'histoire revient sur un autre, la rare d\'avant ne retient pas celle de cette saison', reprises > 0 && raresDeuxieme > 0,
    `${reprises} histoires revues sur un autre joueur · ${raresDeuxieme} rares après une rare la saison d'avant`);
  /* ---------- 4. chacune s'ouvre ---------- */
  const jamais = cles.filter(k => !sortis.has(k));
  exiger('chaque histoire s\'ouvre', !jamais.length, jamais.join(', ') || `${sortis.size} histoires sur 300 saisons`);
  informer('le plus et le moins ouvertes', [...sortis.entries()].sort((p, q) => q[1] - p[1]).filter((_, i, t) => i < 3 || i >= t.length - 3).map(([k, n]) => `${HISTOIRES[k].titre} ${n}`).join(' · '));
}

verdict('Les histoires');
