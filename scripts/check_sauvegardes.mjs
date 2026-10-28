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
  const { BANQUE, poseesSur, buildDe } = await import('../js/banque.js');
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
  let build = null;
  try { build = buildDe(vieille); } catch { build = null; }
  exiger('la confiance se recompte sur ses décisions', !!build);
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
 * UNE PARTIE D'AVANT LA V19 (cinq postes, trois échelons, docs/propositions-coachs-cartes-evenements.md) : ses adjoints
 * portent un poste d'alors (`soins`, `gardiens`) et jusqu'à cinq échelons. Elle se relit : le poste d'alors est lu au
 * poste d'aujourd'hui (un seul adjoint par poste), un échelon de trop s'ignore, et la saison se rejoue pareil.
 */
{
  const { patronsActifs, buildDe } = await import('../js/banque.js');
  const { patronALEchelon, ECHELON_MAX } = await import('../js/echelons.js');
  const { autoRoster, registerHiddenRatings, createTeam, simulateLeague } = await import('../js/sim.js');
  const { TEMOINS, equipeReelle } = await import('./lib/vestiaires.mjs');
  const club = ([lab, sa, t]) => { const ps = equipeReelle(sa, t).flat().map(x => ({ ...x })); ps.forEach(registerHiddenRatings); return createTeam(lab, t, autoRoster(ps), { season: sa }); };
  const ancien = { ...patronALEchelon('per_physioDeRoute', { choix: ['force', 'force', 'defaut', 'force'], depuis: 0 }), role: 'soins', echelon: 5 };
  const gardiens = { ...patronALEchelon('per_gardiensDeRoute', { choix: [], depuis: 0 }), role: 'gardiens' };
  const neuf = patronALEchelon('per_nutritionniste', { choix: [], depuis: 12 });
  const vieille = [{ jour: 0, equipe: 0, patron: ancien }, { jour: 0, equipe: 0, patron: gardiens }];
  const actifs = patronsActifs(vieille, 20);
  exiger('un adjoint d\'avant garde son poste d\'alors dans la partie, lu au poste d\'aujourd\'hui', actifs.length === 2 && actifs.some(x => x.role === 'physique') && actifs.some(x => x.role === 'defense'), actifs.map(x => x.role).join(', '));
  const apres = patronsActifs([...vieille, { jour: 12, equipe: 0, patron: neuf }], 20);
  exiger('un adjoint engagé au même poste remplace celui d\'avant (soins → physique)', apres.length === 2 && apres.find(x => x.role === 'physique').cle === 'per_nutritionniste', apres.map(x => x.cle).join(', '));
  exiger('un échelon de trop (le 5e) ne casse rien : la confiance se recompte', Number.isFinite(Object.values(buildDe(vieille, Infinity, { joues: () => 0 })).reduce((a, b) => a + b, 0)) && ECHELON_MAX === 3);
  const fiche = decisions => { const t = TEMOINS.map(club); simulateLeague(t, 82, { graine: 'reprise-v19', decisions: decisions.map(d => ({ ...d })) }); return t.map(x => `${x.W}-${x.L}-${x.OTL} ${x.GF}-${x.GA}`).join(' '); };
  const a = fiche(vieille), b = fiche(vieille);
  exiger('elle se rejoue au but près', a === b, `${a.split(' ').slice(0, 2).join(' ')} …`);
}

verdict('Le fichier transférable');
