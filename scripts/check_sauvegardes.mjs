/*
 * LE FICHIER TRANSFÉRABLE (1.0). Une partie exportée (js/sauvegardes.js,
 * `exporter`) doit revenir intacte par `importer`, sur un stockage vide comme
 * sur un autre appareil ; et un fichier qui n'est pas une partie doit être
 * refusé, jamais écrit. Le stockage est un faux `localStorage` en mémoire :
 * le module ne touche pas au DOM, il n'a besoin que de ça. Et une partie d'avant la V16, qui nomme des cartes
 * parties, se relit et se rejoue. Et une run de l'ancien Rogue (V28, tranche 4) se solde : elle quitte l'index, verse une
 * fois les médailles qu'elle avait gagnées sans les toucher, et aucune clé de sauvegarde ne change de nom.
 *
 *   node scripts/check_sauvegardes.mjs
 */
import { exiger, verdict } from './verdict.mjs';

const memoire = new Map();
globalThis.localStorage = {
  getItem: k => (memoire.has(k) ? memoire.get(k) : null),
  setItem: (k, v) => { memoire.set(k, String(v)); },
  removeItem: k => { memoire.delete(k); },
};
const { ecrirePartieActive, lireIndex, lirePartieActive, exporter, importer, activer, supprimer } = await import('../js/sauvegardes.js');

// Une partie Rogue en cours, comme `saveGame` l'écrit : un tirage vide, un roster, une run.
const partie = { moteur: 'S82', bonus: 'ROGUE', tirage: [], roster: { 0: { n: 'Untel', s: '1993-94', _renfort: true }, 1: null }, mode: 'CLASSIQUE', rogue: { run: 3, jetons: 12 }, dette: 0, lignes: null };
ecrirePartieActive(partie, { etape: 'Saison 2', qui: 'NHL Stars' });
const source = lireIndex().parties[0];
const f = exporter(source.id);
exiger('exporter rend un nom et un texte', f && /^cap82-rogue-\d{4}-\d{2}-\d{2}\.json$/.test(f.nom) && typeof f.texte === 'string', f ? f.nom : 'rien');
exiger('exporter d\'un id inconnu rend null', exporter('inconnu') === null);

// Un autre appareil : stockage vide, on relit le fichier.
memoire.clear();
const id = importer(f.texte);
exiger('importer crée une partie', !!id);
const ix = lireIndex();
const p = ix.parties.find(x => x.id === id);
exiger('la partie importée est épinglée et marquée', p && p.copie === true && p.importee === true && p.genre === 'rogue' && p.titre === source.titre, p ? `${p.genre} · ${p.titre}` : 'absente');
exiger('son résumé suit', p && p.resume && p.resume.etape === 'Saison 2');
exiger('elle n\'est pas active d\'elle-même', ix.actif !== id);
activer(id);
exiger('la partie relue est identique', JSON.stringify(lirePartieActive()) === JSON.stringify(partie));

// Le même fichier importé deux fois : deux parties, pas une écrasée.
const id2 = importer(f.texte);
exiger('importer deux fois fait deux parties', id2 && id2 !== id && lireIndex().parties.length === 2);
supprimer(id2);

// Ce qui doit être refusé, sans rien écrire.
const avant = lireIndex().parties.length;
const refus = ['', 'pas du JSON', '{}', JSON.stringify({ format: 'autre', partie }), JSON.stringify({ format: 'cap82-partie' }),
  JSON.stringify({ format: 'cap82-partie', partie: { bonus: 'SAISON', roster: {} } }),
  JSON.stringify({ format: 'cap82-partie', partie: { bonus: 'SAISON', tirage: [] } })];
exiger('les faux fichiers sont refusés', refus.every(t => importer(t) === null));
exiger('un refus n\'écrit rien', lireIndex().parties.length === avant && [...memoire.keys()].filter(k => k.startsWith('cap82_partie_')).length === avant);

// Le genre vient de la partie, pas de l'en-tête du fichier.
const menteur = importer(JSON.stringify({ format: 'cap82-partie', genre: 'table', titre: '  ', partie: { ...partie, bonus: 'SAISON', tirage: [{ season: '1993-94', team: 'MTL' }] } }));
const pm = lireIndex().parties.find(x => x.id === menteur);
exiger('le genre se relit dans la partie, le titre vide prend celui du genre', pm && pm.genre === 'saison' && pm.titre === 'Le 82-0', pm ? `${pm.genre} · ${pm.titre}` : 'absente');

/*
 * UNE PARTIE D'AVANT LA V16 (le grand départ, docs/refonte-v16.md) : ses décisions nomment des places, de l'équipement,
 * des clauses et le feu de l'atelier, que la banque et le moteur ne connaissent plus. Elle se relit sans planter : une
 * modif inconnue ne joue pas ; un effet déjà joué porte ses chiffres et se rejoue ; la saison se rejoue au but près.
 * (« Tes cartes » et les cases du verso, où une carte inconnue ne devait plus se montrer, sont partis avec l'ancien Rogue.)
 */
{
  const { autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, getPlayerKey } = await import('../js/sim.js');
  const { TEMOINS, equipeReelle } = await import('./lib/vestiaires.mjs');
  const club = ([lab, sa, t]) => { const ps = equipeReelle(sa, t).flat().map(x => ({ ...x })); ps.forEach(registerHiddenRatings); return createTeam(lab, t, autoRoster(ps), { season: sa }); };
  const ligue = () => TEMOINS.map(club);
  const k = getPlayerKey(SLOTS.filter(sl => !sl.scratch && sl.group === 'F').map(sl => ligue()[0].roster[sl.i]).find(Boolean));
  const effet = { jour: 3, equipe: 0, joue: { src: 'partie', ref: '1:0', id: 'consommable:centTirs' }, effet: { nom: 'Les cent tirs', ico: '🎯', duree: 6, volume: 1.05 } };
  const inconnues = [
    { jour: 0, equipe: 0, palier: 'k:1', achat: { pack: 'mixte', n: 1, prix: 25, sorte: 'cartes', cartes: ['consommable:centTirs', 'joueur:rubanBlanc', 'consommable:physio'] } },
    { jour: 0, equipe: 0, poche: ['consommable:retourFoule'], report: true },
    { jour: 5, equipe: 0, joue: { src: 'partie', ref: '1:1', id: 'joueur:rubanBlanc' }, mutation: { cle: 'rubanBlanc', joueur: k } },
    { jour: 8, equipe: 0, palier: 9, deck: 'atelier', garde: 'joueur:etincelle' },
    { jour: 9, equipe: 0, palier: 'pp:9', place: 'consommable:quatriemeTrio' },
    { jour: 10, equipe: 0, mutation: { cle: 'contrat_bonus', joueur: k } },
  ];
  const vieille = [...inconnues, effet];
  const fiche = decisions => { const t = ligue(); simulateLeague(t, 82, { graine: 'reprise-v16', decisions: decisions.map(d => ({ ...d })) }); return t.map(x => `${x.W}-${x.L}-${x.OTL} ${x.GF}-${x.GA}`).join(' '); };
  const a = fiche(vieille), b = fiche(vieille), sans = fiche([effet]);
  exiger('une partie d\'avant la V16 se rejoue au but près, son effet déjà joué compris', a === b, `${a.split(' ').slice(0, 2).join(' ')} …`);
  exiger('ses places, son équipement et ses clauses ne jouent plus', a === sans, a === sans ? 'la même saison que sans elles' : `${a} contre ${sans}`);
}

/*
 * UNE MÉTA D'AVANT LA TRANCHE 6 (V16, docs/refonte-v16.md § 4d) : ses cartes de masse salariale, ses soins de trop,
 * son congédiement et ses rappels sont partis de la banque. Chacun rend ses médailles, une fois ; les cartes rares
 * qui restent, elle les garde.
 */
{
  const { lireMeta, ecrireMeta } = await import('../js/rogue.js');
  ecrireMeta({ ecussons: 10, inventaire: { 'plafond:grosEspace': 2, 'consommable:congediement': 1, 'consommable:chirurgie': 1 } });
  const m = lireMeta();
  exiger('une méta d\'avant la tranche 6 : ses cartes parties rendent leurs médailles, les rares restent',
    m.ecussons === 19 && Object.keys(m.inventaire).join() === 'consommable:chirurgie', `${m.ecussons} 🏅 · ${Object.keys(m.inventaire).join(', ')}`);
}

/*
 * UNE PARTIE D'AVANT LA V21 (docs/refonte-v21.md ; JP : *on s'en fout de briser les saves*) : le méta se convertit
 * une fois (le personnel et ses doublons partent), et une vieille saison qui porte un adjoint (`patron`) et un coach à
 * paliers se rejoue sans eux : le moteur ne les lit plus, et elle se rejoue au but près.
 */
{
  const { convertirAuJeuNeuf } = await import('../js/rogue.js');
  const vieux = { ecussons: 40, personnel: { per_physioDeRoute: 2 }, copiesPerso: { per_physioDeRoute: 1 }, inventaire: { 'consommable:chirurgie': 1 }, cartes: ['x'] };
  const { meta: neuf } = convertirAuJeuNeuf(vieux);
  exiger('un méta d\'avant la V21 se convertit une fois : le personnel part, les médailles restent',
    neuf && !neuf.personnel && !neuf.copiesPerso && neuf.ecussons === 40 && !Object.keys(neuf.inventaire).length && convertirAuJeuNeuf(neuf) === null);
  /*
   * UNE RUN D'AVANT LA V27 (docs/refonte-v27.md § 6) : la saison en actes ne la rejoue pas. Elle se retire au démarrage
   * (js/game.js) et verse ses médailles comme une saison finie, la moitié de ses points lus dans son résumé ; un méta de
   * la V21 garde son inventaire ; la conversion ne se fait qu'une fois.
   */
  const v21 = { ecussons: 10, ecussonsAVie: 30, inventaire: { a: 1 }, jeu: 'v21' };
  const c = convertirAuJeuNeuf(v21, [{ etape: 'Run 3 · Journée 40 / 165 · 21-15-4' }, { etape: 'Run 2 · Repêchage · 12/23 signés' }, null]);
  exiger('une run d\'avant la V27 verse ses médailles (la moitié de ses points) et la conversion ne se refait pas',
    c && c.verse === 23 && c.meta.ecussons === 33 && c.meta.ecussonsAVie === 53 && c.meta.inventaire.a === 1 && convertirAuJeuNeuf(c.meta) === null,
    `${c ? c.verse : '?'} médailles versées (21-15-4 : 46 points)`);
  const { autoRoster, registerHiddenRatings, createTeam, simulateLeague } = await import('../js/sim.js');
  const { TEMOINS, equipeReelle } = await import('./lib/vestiaires.mjs');
  const club = ([lab, sa, t]) => { const ps = equipeReelle(sa, t).flat().map(x => ({ ...x })); ps.forEach(registerHiddenRatings); return createTeam(lab, t, autoRoster(ps), { season: sa }); };
  const vieille = [
    { jour: 0, equipe: 0, coach: { cle: 'tortue', palier: 2, nom: 'La Tortue II', ico: '🐢' } },
    { jour: 0, equipe: 0, patron: { cle: 'per_physioDeRoute', role: 'physique', defense: 0.95 } },
  ];
  const fiche = decisions => { const t = TEMOINS.map(club); simulateLeague(t, 82, { graine: 'reprise-v21', decisions: decisions.map(d => ({ ...d })) }); return t.map(x => `${x.W}-${x.L}-${x.OTL} ${x.GF}-${x.GA}`).join(' '); };
  const a = fiche(vieille), b = fiche(vieille), sans = fiche(vieille.slice(0, 1));
  exiger('une vieille saison se rejoue au but près, sans son adjoint', a === b && b === sans, `${a.split(' ').slice(0, 2).join(' ')} …`);
}

/*
 * UNE PARTIE D'AVANT LA V22 (docs/refonte-v22.md ; la banque d'événements est partie, le système reste) : ses décisions
 * nomment un dilemme (`m:`), une séquence (`s:`), un courriel ou un point de presse (`vie:`), un fil et un dossier dont
 * la clé n'existe plus. La porte (`appliquerChoix`, js/greffes.js) n'en pose aucun effet, et la saison se rejoue sans planter, au but près, comme
 * si elles n'avaient pas été prises.
 */
{
  const { autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, getPlayerKey } = await import('../js/sim.js');
  const { appliquerChoix } = await import('../js/greffes.js');   // V25 : les histoires sont une greffe du Rogue
  const { TEMOINS, equipeReelle } = await import('./lib/vestiaires.mjs');
  const club = ([lab, sa, t]) => { const ps = equipeReelle(sa, t).flat().map(x => ({ ...x })); ps.forEach(registerHiddenRatings); return createTeam(lab, t, autoRoster(ps), { season: sa }); };
  const ligue = () => TEMOINS.map(club);
  const k = getPlayerKey(SLOTS.filter(sl => !sl.scratch && sl.group === 'F').map(sl => ligue()[0].roster[sl.i]).find(Boolean));
  const vieilles = [
    { jour: 14, equipe: 0, palier: 'm:14', moment: { famille: 'moment', cle: 'tropdejoueurs', choix: 'simplifier' } },
    { jour: 25, equipe: 0, palier: 's:25', moment: { famille: 'sequence', cle: 'defaites', choix: 'cap' } },
    { jour: 33, equipe: 0, palier: 'vie:33', moment: { famille: 'vie', cle: 'e3', choix: 'parler', joueur: k, joueurs: [k] } },
    { jour: 42, equipe: 0, palier: 'fil:42', moment: { famille: 'fil', cle: 'cheechoo', choix: 'monter', joueur: k, joueurs: [k] } },
    { jour: 51, equipe: 0, palier: 'do:7', moment: { famille: 'dossier', cle: 'laPratique', choix: 'systeme', joueur: k, joueurs: [k] } },
  ];
  const equipe = ligue()[0];
  const rienPose = d => { const a = (equipe.effets || []).length, b = (equipe.effetsCibles || []).length, c = (equipe.suivis || []).length; appliquerChoix(equipe, d, 'g'); return (equipe.effets || []).length === a && (equipe.effetsCibles || []).length === b && (equipe.suivis || []).length === c; };
  exiger('une partie d\'avant la V22 : un moment, une séquence, un courriel, un fil et un dossier inconnus ne posent aucun effet (V25 C1 : la porte les ignore)', vieilles.every(rienPose), vieilles.map(d => d.moment.famille).join(', '));
  const fiche = decisions => { const t = ligue(); simulateLeague(t, 82, { graine: 'reprise-v22', decisions: decisions.map(d => ({ ...d, moment: d.moment && { ...d.moment } })) }); return t.map(x => `${x.W}-${x.L}-${x.OTL} ${x.GF}-${x.GA}`).join(' '); };
  const a = fiche(vieilles), b = fiche(vieilles), sans = fiche([]);
  exiger('elle se rejoue au but près, deux passes identiques', a === b, `${a.split(' ').slice(0, 2).join(' ')} …`);
  exiger('ses choix d\'une banque partie ne jouent plus rien : la même saison que sans eux', a === sans, a === sans ? 'la même saison que sans eux' : `${a} contre ${sans}`);
}

/*
 * UNE RUN DE L'ANCIEN ROGUE (V28, tranche 4, docs/refonte-v28.md § 6 ; JP, 9 nov. 2026 : *les runs en cours perdues, les
 * médailles et le cartable gardés*). L'ancien Rogue est parti : au démarrage, ou quand un fichier d'avant s'importe,
 * `solderLAncienRogue` (js/rogue.js) retire chaque partie du genre `rogue` de l'index et verse ce qu'elle avait gagné sans
 * l'avoir touché — ses rondes de séries, payées d'un coup à la fin des séries par le jeu d'avant. Ce qu'on exige :
 *   — la run quitte l'index et sa clé s'efface ; les parties des autres modes ne bougent pas, au caractère près ;
 *   — ses rondes gagnées se versent au barème d'avant (20 la ronde, 40 la Coupe, au multiple de ses exigences) ;
 *   — une fois : un deuxième démarrage ne verse rien, le même fichier réimporté non plus, et des séries que le jeu d'avant
 *     avait déjà payées (la même clé, la graine de la run et l'étape `series`) ne se paient pas deux fois ;
 *   — une run d'avant la saison en actes (un méta d'avant la V27) verse la moitié de ses points, lus dans son résumé ;
 *   — le cartable et la run neuve ne sont pas touchés ; aucune clé de sauvegarde ne change de nom.
 */
{
  const { lireMeta, ecrireMeta, solderLAncienRogue, ecussonsDesSeries, PRIME_EXIGENCE } = await import('../js/rogue.js');
  const lireSource = async f => (await import('node:fs')).readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const depart = () => { memoire.clear(); memoire.set('cap82_cartable', JSON.stringify({ v: 1, joueurs: { '1993-94_MTL_8470000': { v: { commune: 1 }, n: 1 } }, migre: true })); };
  const saison82 = { moteur: 'S148', bonus: 'SAISON', tirage: [{ season: '1993-94', team: 'MTL' }], roster: { 0: { n: 'Untel', s: '1993-94' } }, mode: 'CLASSIQUE', partie: { graine: 'g82', journee: 82, decisions: [] } };
  // Une run en actes (V27) laissée en séries : deux rondes gagnées, elle regardait la troisième ; cran d'exigence 2.
  const enSeries = { moteur: 'S148', bonus: 'ROGUE', tirage: [], roster: { 0: { n: 'Untel', s: '1993-94' } }, mode: 'CLASSIQUE',
    rogue: { numero: 4, exigence: 2, coach: { cle: 'essaim' } }, partie: { graine: 'gRun1', journee: 82, decisions: [{ jour: 0, equipe: 0, coach: { cle: 'essaim' } }], series: { ronde: 2, revele: [] } } };
  // Une run finie sur la Coupe, que le jeu d'avant n'a pas eu le temps de payer.
  const coupe = { ...enSeries, rogue: { numero: 5, exigence: 0, series: { rondes: 4, coupe: true } }, partie: { ...enSeries.partie, graine: 'gRun2', series: { ronde: 3, revele: [] } } };
  // Une run en saison : ses actes ont versé leurs médailles le soir même, rien ne reste à verser.
  const enSaison = { ...enSeries, rogue: { numero: 6 }, partie: { graine: 'gRun3', journee: 31, decisions: [] } };

  depart();
  ecrireMeta({ ...lireMeta(), jeu: 'v27', ecussons: 10, ecussonsAVie: 25, runs: 6, deblocages: ['caisse1'] });
  ecrirePartieActive(saison82, { etape: 'Bilan', qui: 'NHL Stars' });
  const id82 = lireIndex().actif, texte82 = memoire.get(`cap82_partie_${id82}`);
  const fichiers = [];
  for (const run of [enSeries, coupe, enSaison]) { const id = importer(JSON.stringify({ format: 'cap82-partie', partie: run })); activer(id); fichiers.push(exporter(id).texte); }
  const idsRuns = lireIndex().parties.filter(x => x.genre === 'rogue').map(x => x.id);
  exiger('la vieille sauvegarde porte trois runs de l\'ancien Rogue et une partie du 82-0', idsRuns.length === 3 && lireIndex().parties.length === 4, lireIndex().parties.map(x => x.genre).join(', '));

  const multiple = 1 + PRIME_EXIGENCE * 2;
  const attendu = Math.round(ecussonsDesSeries(2, false) * multiple) + ecussonsDesSeries(4, true);
  const r1 = solderLAncienRogue(), m1 = lireMeta(), ix1 = lireIndex();
  exiger('les runs de l\'ancien Rogue quittent l\'index, leurs clés s\'effacent, l\'index ne pointe vers aucune partie retirée',
    r1.runs === 3 && !ix1.parties.some(x => x.genre === 'rogue') && idsRuns.every(id => !memoire.has(`cap82_partie_${id}`)) && (ix1.actif === null || ix1.parties.some(x => x.id === ix1.actif)),
    `${r1.runs} runs arrêtées · ${ix1.parties.length} partie(s) restent`);
  exiger('la partie du 82-0 ne bouge pas, au caractère près', ix1.parties.length === 1 && ix1.parties[0].id === id82 && memoire.get(`cap82_partie_${id82}`) === texte82);
  exiger(`leurs rondes de séries se versent au barème d'avant : 2 rondes au cran 2 (×${multiple}), la Coupe en 4 rondes, rien pour la run en saison`,
    r1.verse === attendu && attendu === 52 + 120 && m1.ecussons === 10 + attendu && m1.ecussonsAVie === 25 + attendu && m1.coupes === 1 && m1.exigence === 0,
    `${r1.verse} médailles versées (attendu ${attendu}) · ${m1.ecussons} 🏅 · ${m1.coupes} Coupe`);
  exiger('le reste du méta ne bouge pas : les runs comptées, les déblocages', m1.runs === 6 && m1.deblocages.join() === 'caisse1' && m1.jeu === 'v27');
  const r2 = solderLAncienRogue();
  exiger('un deuxième démarrage ne solde plus rien', r2.runs === 0 && r2.verse === 0 && lireMeta().ecussons === m1.ecussons, `${r2.runs} run, ${r2.verse} médaille`);
  // Le même fichier réimporté (un autre appareil, une copie gardée) : la run se solde encore, ses médailles non.
  const idRe = importer(fichiers[0]);
  const r3 = solderLAncienRogue();
  exiger('le même fichier réimporté se solde sans verser deux fois', !!idRe && r3.runs === 1 && r3.verse === 0 && lireMeta().ecussons === m1.ecussons && !lireIndex().parties.some(x => x.genre === 'rogue'), `${r3.runs} run, ${r3.verse} médaille`);
  exiger('le cartable et la run neuve ne sont pas touchés', JSON.parse(memoire.get('cap82_cartable')).joueurs['1993-94_MTL_8470000'].n === 1 && !memoire.has('cap82_run'));

  // Des séries que le jeu d'avant avait déjà payées à leur fin : la même clé, rien de plus.
  depart();
  ecrireMeta({ ...lireMeta(), jeu: 'v27', ecussons: 200, recompenses: { 'gRun2:series': true } });
  importer(JSON.stringify({ format: 'cap82-partie', partie: coupe }));
  const r4 = solderLAncienRogue();
  exiger('des séries déjà payées par le jeu d\'avant ne se paient pas deux fois', r4.runs === 1 && r4.verse === 0 && lireMeta().ecussons === 200, `${r4.verse} médaille`);

  // Un méta d'avant la V27 : la run verse la moitié de ses points, lus dans son résumé, et le méta se convertit une fois.
  depart();
  ecrireMeta({ ecussons: 10, ecussonsAVie: 30, inventaire: {}, jeu: 'v21' });
  ecrirePartieActive({ ...enSaison, partie: null }, { etape: 'Run 3 · Journée 40 / 165 · 21-15-4', qui: 'NHL Stars' });
  const r5 = solderLAncienRogue(), m5 = lireMeta();
  exiger('une run d\'avant la saison en actes verse la moitié de ses points, une fois', r5.runs === 1 && r5.verse === 23 && m5.ecussons === 33 && m5.jeu === 'v27' && solderLAncienRogue().verse === 0 && lireMeta().ecussons === 33,
    `${r5.verse} médailles (21-15-4 : 46 points)`);

  // Un joueur neuf : rien à solder, le méta prend la marque du jeu d'aujourd'hui sans rien inventer.
  depart();
  const r6 = solderLAncienRogue(), m6 = lireMeta();
  exiger('sans vieille run, rien ne se solde et rien ne se verse', r6.runs === 0 && r6.verse === 0 && m6.ecussons === 0 && m6.runs === 0);

  // Les clés de sauvegarde gardent leur nom : celles que le stockage a vues ici, et celles que les modules écrivent.
  const vues = [...memoire.keys()].filter(k => !/^cap82_(parties|partie_[a-z0-9]+|rogue|cartable)$/.test(k));
  const CLES = [['js/sauvegardes.js', /const INDEX = 'cap82_parties'/], ['js/sauvegardes.js', /const ANCIENNE = 'cap82_save'/], ['js/sauvegardes.js', /const cle = id => `cap82_partie_\$\{id\}`/],
    ['js/rogue.js', /const CLE_META = 'cap82_rogue'/], ['js/cartable.js', /const CLE_CARTABLE = 'cap82_cartable'/], ['js/run-jeu.js', /const CLE = 'cap82_run'/]];
  const bougees = [];
  for (const [f, re] of CLES) if (!re.test(await lireSource(f))) bougees.push(`${f} ${re}`);
  exiger('aucune clé de sauvegarde ne change de nom', !vues.length && !bougees.length, [...vues, ...bougees].join(' · ') || `${CLES.length} clés en place`);
}

verdict('Le fichier transférable');
