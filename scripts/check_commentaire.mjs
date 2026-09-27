/*
 * LE COMMENTATEUR DU DIRECT (S70) — ce qui doit tenir.
 *
 *   node scripts/check_commentaire.mjs
 *
 * JP : *une grosse database de phrases que le commentateur peut dire, voire
 * mix and match pour variété max*. On exige :
 *   1. aucun gabarit oublié ({t}, undefined), aucune ponctuation cassée ;
 *   2. un match ne radote pas : ses arrêts racontés sont tous différents ;
 *   3. la même graine redit la même chose (le direct qui reprend au deuxième
 *      entracte redit mot pour mot les deux premières périodes) ;
 *   4. le contexte parle : doublé, tour du chapeau, prolongation, égalité,
 *      avantage numérique ;
 *   5. et on compte : combien de phrases différentes chaque événement peut dire.
 */
import * as C from '../js/commentaire.js';
import { GESTES } from '../js/recit.js';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const { commentateur } = C;
const propre = s => typeof s === 'string' && s.length > 3 && !/[{}]|undefined|\bnull\b|NaN|\s{2,}|\s[,.]|\.\.(?!\.)|^\s|\s$/.test(s);
const joueur = n => `<b>${n}</b>`;
const baseArret = { t: joueur('Lafleur'), g: joueur('Dryden'), att: 'Canadiens', def: 'Bruins', nArrets: 12, r: '04:12' };

console.log('\n  Le commentateur du direct (S70)\n');

/* ---------- 1. les banques ---------- */
const banques = Object.entries(C).filter(([, v]) => Array.isArray(v));
for (const [nom, liste] of banques) exiger(`${nom} : ni vide ni doublon`, liste.length >= 2 && new Set(liste).size === liste.length, `${liste.length} pièces`);
for (const [nom, obj] of Object.entries(C).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))) {
  for (const [k, liste] of Object.entries(obj)) exiger(`${nom}.${k} : ni vide ni doublon`, Array.isArray(liste) && liste.length >= 2 && new Set(liste).size === liste.length, `${liste.length}`);
}

/* ---------- 2. un match ne radote pas ---------- */
{
  const com = commentateur('match-1');
  const dits = [];
  for (let i = 0; i < 40; i++) dits.push(com.arret({ ...baseArret }));
  exiger('quarante arrêts racontés dans un match, quarante phrases différentes', new Set(dits).size === dits.length, `${new Set(dits).size}/${dits.length}`);
  exiger('chaque phrase d\'arrêt est propre', dits.every(propre), dits.find(d => !propre(d)) || '');
  const tirs = Array.from({ length: 50 }, () => com.tir({ t: joueur('Bossy'), g: joueur('Smith') }));
  exiger('cinquante tirs ordinaires, tous propres', tirs.every(propre), tirs.find(d => !propre(d)) || '');
  informer('exemples d\'arrêts', dits.slice(0, 3).map(x => x.replace(/<[^>]+>/g, '')).join('  ·  '));
}

/* ---------- 3. la même graine redit la même chose ---------- */
{
  const dire = g => { const com = commentateur(g); return [com.debut(), com.arret({ ...baseArret }), com.defense(baseArret), com.tir(baseArret),
    com.but({ but: { marqueur: { n: 'Guy Lafleur', p: 'RW' }, passeurs: [] }, m: 'Lafleur', g: 'Cheevers', eq: 'Canadiens', autre: 'Bruins', pour: 1, contre: 0, nMatch: 1 })].join('|'); };
  exiger('la même graine redit mot pour mot', dire(77) === dire(77));
  exiger('une autre graine dit autre chose', dire(77) !== dire(78));
}

/* ---------- 4. le contexte parle ---------- */
{
  const com = commentateur('ctx');
  const but = (x, b = {}) => com.but({ but: { marqueur: { n: 'Mike Bossy', p: 'RW' }, passeurs: [{}], ...b }, m: 'Bossy', g: 'Hextall',
    eq: 'Islanders', autre: 'Flyers', pour: 1, contre: 0, nMatch: 1, r: '02:00', ...x });
  const plats = s => s.replace(/<[^>]+>/g, '');
  const cas = [
    ['le tour du chapeau se dit', but({ nMatch: 3, pour: 3, contre: 1 }), /chapeau/i],
    ['la prolongation se dit', but({ ot: true, pour: 3, contre: 2 }, { gagnant: true }), /prolongation|mort subite|banc saute|survit/i],
    ['l\'égalité se dit', but({ pour: 2, contre: 2 }), /égalit|recommencer|revient|efface|égaux|nouveau match|dernier mot/i],
    ['le premier but se dit', but({ pour: 1, contre: 0 }), /glace|premier|ouvr|marque est ouverte/i],
    ['la raclée se dit', but({ pour: 6, contre: 1 }), /raclée|cauchemar|lève pas|quitter|dépassé/i],
  ];
  for (const [nom, phrase, re] of cas) exiger(nom, re.test(plats(phrase)) && propre(phrase), plats(phrase));
  const an = Array.from({ length: 12 }, () => plats(com.but({ but: { marqueur: { n: 'Mario Lemieux', p: 'C' }, passeurs: [{}, {}], an: true }, m: 'Lemieux', g: 'Roy', eq: 'Penguins', autre: 'Canadiens', pour: 2, contre: 0, nMatch: 1 })));
  exiger('l\'avantage numérique se dit, souvent', an.filter(s => /avantage|puissance|punition|joueur de plus/i.test(s)).length >= 4, `${an.filter(s => /avantage|puissance|punition|joueur de plus/i.test(s)).length}/12`);
  const pun = com.punition({ j: joueur('Chelios'), eq: 'Canadiens', autre: 'Blackhawks', tard: true });
  exiger('la punition dit l\'infraction et l\'avantage', propre(pun) && C.INFRACTIONS.some(i => pun.includes(i)), plats(pun));
  const P = com.periode({ per: '3e période', ot: true, s: '2-2' });
  exiger('la fin de la troisième à égalité annonce la prolongation', /prolongation|supplémentaire|mort subite/i.test(P.couleur), P.couleur);
  const F = com.fin({ eq: 'Oilers', autre: 'Flames', g: 'Fuhr', blanchissage: true, ecart: 3 });
  exiger('le blanchissage se dit à la fin', /Fuhr/.test(F.couleur), F.couleur);
}

/* ---------- 5. l'étendue ---------- */
{
  const n = l => l.length;
  const arrets = (n(C.CRI_ARRET) + 1) * n(C.ACTION_TIREUR) * n(C.LIEN_ARRET) * n(C.ISSUE_GARDIEN) * 2 * (n(C.CHUTE_ARRET) + 1);
  const buts = n(C.CRI_BUT) * Object.values(GESTES).reduce((a, l) => a + l.length, 0) * (n(C.APPUI_SOLO) + n(C.APPUI_SEQUENCE) + 1)
    * Object.values(C.CONTEXTE_BUT).reduce((a, l) => a + l.length, 0);
  const defense = (n(C.CRI_DEFENSE) + 1) * n(C.ACTION_DEFENSE) * 2 * (n(C.CHUTE_DEFENSE) + 1);
  const punitions = n(C.PHRASE_PUNITION) * n(C.INFRACTIONS) * n(C.PHRASE_AVANTAGE) * (n(C.COULEUR_PUNITION) + 1);
  const pieces = banques.reduce((a, [, l]) => a + l.length, 0) + Object.values(C.CONTEXTE_BUT).reduce((a, l) => a + l.length, 0);
  const fmt = x => x.toLocaleString('fr-CA');
  informer('pièces dans les banques', fmt(pieces));
  informer('arrêts dangereux possibles', fmt(arrets));
  informer('buts possibles', fmt(buts));
  informer('jeux défensifs possibles', fmt(defense));
  informer('punitions possibles', fmt(punitions));
  borne('arrêts dangereux possibles (en millions)', arrets / 1e6, 1, Infinity, ' M');
  // Dans une vraie saison, deux arrêts pris au hasard ne se ressemblent presque jamais.
  const vus = new Set(); let total = 0;
  for (let m = 0; m < 100; m++) { const com = commentateur(`saison-${m}`); for (let i = 0; i < 11; i++) { vus.add(com.arret({ ...baseArret })); total++; } }
  borne('arrêts différents sur une saison de 1 100 arrêts racontés', 100 * vus.size / total, 97, 100, ' %');
}

/* ---------- 6. les phrases collent au joueur et au système (S71) ---------- */
{
  const texteDe = (liste, tag) => new Set(liste.filter(([, t]) => t.split(' ').includes(tag)).map(([x]) => x));
  // Un défenseur ne reçoit jamais une action réservée aux avants.
  const com = commentateur('poste');
  const avants = [...texteDe(C.ACTIONS_TIREUR, 'F')].map(g => g.replace('{t} ', '').slice(0, 22));
  const dD = Array.from({ length: 80 }, () => com.arret({ ...baseArret, t: joueur('Bourque'), poste: 'D' }));
  const fautifs = dD.filter(d => avants.some(a => d.includes(a)));
  exiger('un défenseur ne file jamais en échappée : aucune action d\'avant pour lui', fautifs.length === 0, fautifs[0] ? fautifs[0].replace(/<[^>]+>/g, '') : `${dD.length} arrêts`);
  // Un avant rapide en contre-attaque : la plupart de ses actions collent.
  const rapides = [...new Set([...texteDe(C.ACTIONS_TIREUR, 'rapide'), ...texteDe(C.ACTIONS_TIREUR, 'contre')])].map(g => g.replace('{t} ', '').slice(0, 22));
  const dR = Array.from({ length: 60 }, () => com.arret({ ...baseArret, t: joueur('Bure'), poste: 'F', style: 'rapide', tac: 'contre' }));
  const part = dR.filter(d => rapides.some(a => d.includes(a))).length / dR.length;
  borne('un avant rapide en contre-attaque : actions qui collent', 100 * part, 50, 100, ' %');
}

verdict('Le commentateur');
