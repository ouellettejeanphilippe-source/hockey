/*
 * LE FICHIER TRANSFÉRABLE (1.0). Une partie exportée (js/sauvegardes.js,
 * `exporter`) doit revenir intacte par `importer`, sur un stockage vide comme
 * sur un autre appareil ; et un fichier qui n'est pas une partie doit être
 * refusé, jamais écrit. Le stockage est un faux `localStorage` en mémoire :
 * le module ne touche pas au DOM, il n'a besoin que de ça. Et une partie d'avant la V16, qui nomme des cartes
 * parties, se relit et se rejoue.
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
 * carte inconnue ne se montre plus nulle part et ne prend pas de case ; une modif inconnue ne joue pas ; un effet déjà
 * joué porte ses chiffres et se rejoue ; la saison se rejoue au but près.
 */
{
  const { cartesDeLaPartie } = await import('../js/inventaire.js');
  const { BANQUE, poseesSur } = await import('../js/banque.js');
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
  const cartes = cartesDeLaPartie({ decisions: vieille, rogue: true });
  exiger('une partie d\'avant la V16 : ses cartes inconnues ne se montrent plus', cartes.every(x => BANQUE[x.id]) && cartes.some(x => x.id === 'consommable:physio'), cartes.map(x => x.id).join(', ') || 'aucune');
  exiger('une modif inconnue ne prend pas de case au verso', poseesSur(vieille, k).length === 0);
  const fiche = decisions => { const t = ligue(); simulateLeague(t, 82, { graine: 'reprise-v16', decisions: decisions.map(d => ({ ...d })) }); return t.map(x => `${x.W}-${x.L}-${x.OTL} ${x.GF}-${x.GA}`).join(' '); };
  const a = fiche(vieille), b = fiche(vieille), sans = fiche([effet]);
  exiger('elle se rejoue au but près, son effet déjà joué compris', a === b, `${a.split(' ').slice(0, 2).join(' ')} …`);
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
  const neuf = convertirAuJeuNeuf(vieux);
  exiger('un méta d\'avant la V21 se convertit une fois : le personnel part, les médailles restent',
    neuf && !neuf.personnel && !neuf.copiesPerso && neuf.ecussons === 40 && !Object.keys(neuf.inventaire).length && convertirAuJeuNeuf(neuf) === null);
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
 * la clé n'existe plus. `effetDeMoment` n'en pose aucun effet, et la saison se rejoue sans planter, au but près, comme
 * si elles n'avaient pas été prises.
 */
{
  const { autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, getPlayerKey, effetDeMoment } = await import('../js/sim.js');
  const { TEMOINS, equipeReelle } = await import('./lib/vestiaires.mjs');
  const club = ([lab, sa, t]) => { const ps = equipeReelle(sa, t).flat().map(x => ({ ...x })); ps.forEach(registerHiddenRatings); return createTeam(lab, t, autoRoster(ps), { season: sa }); };
  const ligue = () => TEMOINS.map(club);
  const k = getPlayerKey(SLOTS.filter(sl => !sl.scratch && sl.group === 'F').map(sl => ligue()[0].roster[sl.i]).find(Boolean));
  const vieilles = [
    { jour: 14, equipe: 0, palier: 'm:14', moment: { famille: 'moment', cle: 'tropdejoueurs', choix: 'simplifier' } },
    { jour: 25, equipe: 0, palier: 's:25', moment: { famille: 'sequence', cle: 'defaites', choix: 'cap' } },
    { jour: 33, equipe: 0, palier: 'vie:33', moment: { famille: 'vie', cle: 'e3', choix: 'parler', joueur: k, joueurs: [k] } },
    { jour: 42, equipe: 0, palier: 'fil:42', moment: { famille: 'fil', cle: 'cheechoo', choix: 'monter', joueur: k, joueurs: [k] } },
    { jour: 51, equipe: 0, palier: 'do:7', moment: { famille: 'dossier', cle: 'laRoute', choix: 'nolise', joueur: k, joueurs: [k] } },
  ];
  const equipe = ligue()[0];
  exiger('une partie d\'avant la V22 : un moment, une séquence, un courriel, un fil et un dossier inconnus ne posent aucun effet', vieilles.every(d => effetDeMoment(d, equipe) === null), vieilles.map(d => d.moment.famille).join(', '));
  const fiche = decisions => { const t = ligue(); simulateLeague(t, 82, { graine: 'reprise-v22', decisions: decisions.map(d => ({ ...d, moment: d.moment && { ...d.moment } })) }); return t.map(x => `${x.W}-${x.L}-${x.OTL} ${x.GF}-${x.GA}`).join(' '); };
  const a = fiche(vieilles), b = fiche(vieilles), sans = fiche([]);
  exiger('elle se rejoue au but près, deux passes identiques', a === b, `${a.split(' ').slice(0, 2).join(' ')} …`);
  exiger('ses choix d\'une banque partie ne jouent plus rien : la même saison que sans eux', a === sans, a === sans ? 'la même saison que sans eux' : `${a} contre ${sans}`);
}

verdict('Le fichier transférable');
