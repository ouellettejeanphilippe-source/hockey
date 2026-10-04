/*
 * LE PROFIL DE STYLE (js/profil-style.js) — la preuve que ton build joue, et que cette preuve est vraie.
 *
 * JP : *ça doit être clair que le build que je fais a un impact pour vrai.* L'écran dit « tes dix derniers
 * matchs : 24 tirs pour, 25 contre, ligue 28 » et « ce soir, avec ces cartes : 22 tirs ». Ces chiffres ne
 * valent que s'ils sont ceux des feuilles. Ce script prouve, sur une ligue de 32 vrais clubs jouée avec
 * quelques décisions :
 *
 *   1. ton profil égale un recalcul INDÉPENDANT sur les feuilles (les tirs recomptés lancer par lancer, les
 *      buts compté but par but, les punitions une à une, les coups lus à la source) ;
 *   2. sur toute la saison, les buts du profil refont ceux de la fiche du club (GF, GA) ;
 *   3. la moyenne de la ligue égale son recalcul, et ses tirs pour égalent ses tirs contre (une ligue fermée) ;
 *   4. le mot de style ne bouge pas pour un même historique, et ne vient que d'un écart franchi ;
 *   5. sans assez de matchs, ou sans ligue, il n'y a ni profil, ni mot, ni carton : aucun texte sans donnée ;
 *   6. « ton build ce soir » relit les décisions du jour (une carte prise au jour 3 n'était pas active au jour 2)
 *      et ne dit « rien de réglé » que quand rien ne l'était ;
 *   7. lire le profil ne change pas une seule journée.
 *
 *   node scripts/check_profil.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJournee, jouerJusqua, bilanLigue } from '../js/sim.js';
import { payloadDe } from '../js/banque.js';
import { matchsJoues, profilDuClub, profilDeLigue, motDeStyle, chiffresDuMatch, buildDuSoir, buildVide, ecartsDuSoir, N_PROFIL, MIN_MATCHS, MIN_LIGUE, SEUILS } from '../js/profil-style.js';
import { cartesDeStyle } from '../js/entracte.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
function ligue(seed, n = 32) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const sh = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    const p = un.flat().map(q => ({ ...q })); p.forEach(registerHiddenRatings);
    out.push(createTeam(`${tag} ${sh.season}`, tag, autoRoster(p), { season: sh.season }));
  }
  return out;
}

const decisions = [
  { jour: 0, equipe: 0, carte: 'bloc' },
  { jour: 3, equipe: 0, carte: 'fougue' },
  { jour: 0, equipe: 0, ...payloadDe('patron:att_adjoint') },
  { jour: 6, equipe: 0, match: { importance: 'basse', ad: -1 } },
  { jour: 10, equipe: 0, lignes: [0, 1, 2, 3].map(() => ({ tac: 'defensive', tacD: 'maison', agr: 0 })) },
];
const aplatir = x => JSON.stringify(x);
const pres = (a, b, e = 1e-9) => Math.abs(a - b) < e;

console.log('\n  LE PROFIL DE STYLE\n');

const teams = ligue(7700);
const L = creerLigue(teams, 82, { graine: 'profil', decisions });
const toi = teams[0];
jouerJusqua(L, 30);
const matchs = matchsJoues(L.calendrier);
const miens = matchs.filter(m => m.A === toi || m.B === toi);

// 1. Le recalcul indépendant, sur les feuilles, lancer par lancer.
const recompte = (m, cote) => {
  const f = m.f, autre = cote === 'A' ? 'B' : 'A';
  let pour = 0, contre = 0, butsP = 0, butsC = 0, pun = 0;
  for (const l of f.lancers) { if (l.cote === cote) pour++; else if (l.cote === autre) contre++; }
  for (const b of f.buts) { if (b.cote === cote) butsP++; else butsC++; }
  for (const p of f.punitions) if (p.cote === cote) pun++;
  return { pour, contre, butsP, butsC, pun, coups: f.coups[cote] };
};
const derniers = miens.slice(-N_PROFIL);
const P = profilDuClub(matchs, toi);
const moy = f => derniers.reduce((a, m) => a + f(recompte(m, m.A === toi ? 'A' : 'B')), 0) / derniers.length;
exiger('le profil lit tes 10 derniers matchs', P && P.n === N_PROFIL, `${P && P.n} matchs`);
exiger('tirs pour et contre = les lancers recomptés un à un', pres(P.tirsPour, moy(r => r.pour)) && pres(P.tirsContre, moy(r => r.contre)),
  `${P.tirsPour.toFixed(2)} / ${P.tirsContre.toFixed(2)}`);
exiger('buts pour et contre = les buts recomptés un à un', pres(P.butsPour, moy(r => r.butsP)) && pres(P.butsContre, moy(r => r.butsC)),
  `${P.butsPour.toFixed(2)} / ${P.butsContre.toFixed(2)}`);
exiger('punitions = celles de ton club, recomptées', pres(P.punitions, moy(r => r.pun)), P.punitions.toFixed(2));
exiger('mises en échec = les coups de la feuille (attendus, pas comptés un à un)', pres(P.coups, moy(r => r.coups)), P.coups.toFixed(1));
exiger('le rythme est la somme des tirs des deux clubs', pres(P.rythme, P.tirsPour + P.tirsContre), P.rythme.toFixed(2));
// Le « 10 derniers » dépend du côté : un match à domicile et un match chez l'autre s'additionnent pareil.
exiger('chaque match se lit du bon côté', derniers.every(m => { const c = m.A === toi ? 'A' : 'B'; const x = chiffresDuMatch(m.f, c); return x.butsPour === (c === 'A' ? m.f.gfA : m.f.gfB); }));

// 2. Toute la saison jouée : les buts du profil refont la fiche du club.
jouerJusqua(L, 200);
bilanLigue(L);
const tout = matchsJoues(L.calendrier);
const S = profilDuClub(tout, toi, { n: 82 });
exiger('sur 82 matchs, les buts du profil refont GF et GA de la fiche', S && pres(S.butsPour * S.n, toi.GF) && pres(S.butsContre * S.n, toi.GA), `${(S.butsPour * S.n).toFixed(0)}/${toi.GF} · ${(S.butsContre * S.n).toFixed(0)}/${toi.GA}`);

// 3. La ligue : son recalcul, et la symétrie des tirs.
const Lg = profilDeLigue(tout, toi);
let sT = 0, sB = 0, sP = 0, k = 0;
for (const m of tout) for (const c of ['A', 'B']) {
  if ((c === 'A' ? m.A : m.B) === toi) continue;
  sT += m.f.lancers.filter(l => l.cote === c).length; sB += c === 'A' ? m.f.gfA : m.f.gfB; sP += m.f.punitions.filter(p => p.cote === c).length; k++;
}
exiger('la ligue : les tirs, les buts et les punitions des autres clubs, recomptés', Lg && pres(Lg.tirsPour, sT / k) && pres(Lg.butsPour, sB / k) && pres(Lg.punitions, sP / k),
  `${Lg.tirsPour.toFixed(2)} tirs · ${Lg.butsPour.toFixed(2)} buts · ${Lg.punitions.toFixed(2)} punitions sur ${k} côtés`);
exiger('une ligue fermée : ses tirs contre égalent ses tirs pour', Math.abs(Lg.tirsPour - Lg.tirsContre) < 0.6, `${Lg.tirsPour.toFixed(2)} / ${Lg.tirsContre.toFixed(2)}`);

// 4. Le mot de style : même historique, même mot ; chaque mot a son écart.
const style = motDeStyle(P, Lg);
exiger('le mot de style est le même pour le même historique', aplatir(style) === aplatir(motDeStyle(profilDuClub(matchs, toi), profilDeLigue(tout, toi))));
const base = { n: 10, tirsPour: 28, tirsContre: 28, butsPour: 3, butsContre: 3, punitions: 3.8, coups: 22, rythme: 56 };
const mot = p => motDeStyle({ ...base, ...p }, base).mots.join('|');
exiger('un rythme sous la ligue de 4 tirs dit « jeu fermé »', mot({ rythme: 56 - SEUILS.rythme }) === 'jeu fermé');
exiger('… et un rythme au-dessus dit « jeu ouvert »', mot({ rythme: 56 + SEUILS.rythme }) === 'jeu ouvert');
exiger('des coups à +4 disent « jeu de contact »', mot({ coups: 22 + SEUILS.coups }) === 'jeu de contact');
exiger('une punition de plus dit « indiscipliné », une de moins « discipliné »', mot({ punitions: 3.8 + SEUILS.punitions }) === 'indiscipliné' && mot({ punitions: 3.8 - SEUILS.punitions }) === 'discipliné');
exiger('sous les seuils, aucun mot', mot({ rythme: 54, coups: 24, punitions: 4.3 }) === '');
exiger('un jeu pauvre n\'est pas dit fermé : tirer moins sans que les autres tirent moins a sa propre note',
  motDeStyle({ ...base, tirsPour: 24, tirsContre: 28, rythme: 52 }, base).note.includes('plus pauvre'));

// 5. Aucun texte sans donnée suffisante.
const peu = matchs.filter(m => m.A === toi || m.B === toi).slice(0, MIN_MATCHS - 1);
exiger(`moins de ${MIN_MATCHS} matchs : pas de profil`, profilDuClub(peu, toi) === null);
exiger(`moins de ${MIN_LIGUE} côtés de ligue : pas de moyenne`, profilDeLigue(matchsJoues(L.calendrier.slice(0, 1)).slice(0, 5), toi) === null);
exiger('sans profil ou sans ligue, aucun mot et aucun carton', motDeStyle(null, Lg) === null && motDeStyle(P, null) === null
  && cartesDeStyle({ profil: null, ligue: Lg, style }).length === 0 && cartesDeStyle({ profil: P, ligue: null, style }).length === 0);
const cartons = cartesDeStyle({ profil: P, ligue: Lg, style });
exiger('avec les données : deux cartons, sans cote ni pourcentage', cartons.length === 2 && !cartons.some(c => /%|cote/i.test(c.corps)), `${cartons.length} cartons`);
const sansCoups = cartesDeStyle({ profil: { ...P, coups: null }, ligue: Lg, style: motDeStyle({ ...P, coups: null }, Lg) });
exiger('une feuille sans mises en échec ne les affiche pas', !/Mises en échec/.test(sansCoups[1].corps));

// 6. Ton build ce soir.
const b2 = buildDuSoir(toi, L.decisions, 2), b3 = buildDuSoir(toi, L.decisions, 3), b6 = buildDuSoir(toi, L.decisions, 6), b7 = buildDuSoir(toi, L.decisions, 7), b12 = buildDuSoir(toi, L.decisions, 12);
exiger('une carte prise au jour 3 n\'était pas active au jour 2, et l\'est au jour 3', b2.cartes.length === 1 && b3.cartes.length === 2, `${b2.cartes.join(', ')} → ${b3.cartes.join(', ')}`);
exiger('le patron pris au jour 0 est actif', b2.patrons.length === 1, b2.patrons.join(', '));
exiger('la consigne ne vaut que le soir où elle est réglée', !!b6.consigne && !b7.consigne, `${b6.consigne}`);
exiger('les systèmes ne comptent qu\'après la décision des lignes', !b7.systemes.length && b12.systemes.length >= 2 && b12.agressivites.length === 1, `${b12.systemes.join(', ')} · ${b12.agressivites.join(', ')}`);
exiger('un soir sans rien de réglé se dit vide', buildVide(buildDuSoir(toi, [], 4)) && !buildVide(b3));
const lignes = ecartsDuSoir(toi === miens[0].A ? miens[0].f : miens[0].f, miens[0].A === toi ? 'A' : 'B', P, Lg);
exiger('l\'écart du soir porte le soir, ta moyenne et la ligue', lignes.length >= 5 && lignes.every(r => Number.isFinite(r.soir) && r.moyenne != null && r.ligue != null), lignes.map(r => `${r.nom} ${r.soir}`).join(' · '));
exiger('sans moyenne d\'avant, la colonne manque au lieu d\'être inventée', ecartsDuSoir(miens[0].f, 'A', null, null).every(r => r.moyenne === null && r.ligue === null));

// 7. Lire le profil ne change pas la saison.
const joue = lire => {
  const T = ligue(7800);
  const l = creerLigue(T, 82, { graine: 'profil-rejeu', decisions });
  while (!l.fini) {
    if (lire) { const ms = matchsJoues(l.calendrier); profilDuClub(ms, T[0], { avant: l.jour }); profilDeLigue(ms, T[0]); buildDuSoir(T[0], l.decisions, l.jour); }
    jouerJournee(l);
  }
  bilanLigue(l);
  return T.map(x => `${x.W}-${x.L}-${x.OTL}-${x.GF}-${x.GA}`).join('|');
};
exiger('lire le profil chaque matin ne change pas une seule journée', joue(true) === joue(false));

informer('ton profil, tel que l\'écran le montre', `${P.tirsPour.toFixed(1)} / ${P.tirsContre.toFixed(1)} tirs, ${P.butsPour.toFixed(2)} / ${P.butsContre.toFixed(2)} buts, ${P.punitions.toFixed(1)} punitions, ${P.coups.toFixed(0)} coups, rythme ${P.rythme.toFixed(1)} (ligue ${Lg.rythme.toFixed(1)}) : ${style.mots.join(' · ') || 'dans la moyenne'}`);
verdict('Le profil de style');
