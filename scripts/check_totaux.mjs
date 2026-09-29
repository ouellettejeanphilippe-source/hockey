/*
 * LES TOTAUX DU SOIR (1.0, C5) — ce que l'écran annonce est ce que le moteur applique.
 *
 * JP : *je comprends pas plusieurs mécaniques*. « Préparer le match » et la
 * carte du prochain match disent « Ce soir : Tirs +14 % · Précision −3 % ·
 * Buts contre −6 % · Punitions +10 % ». Ce script prouve, sur une vraie équipe
 * qui porte cinq effets à la fois (deux cartes de saison, deux patrons, la
 * consigne du match choisie le matin même) :
 *
 *   1. les effets se MULTIPLIENT : le total brut est le produit des sources ;
 *   2. le total affiché est le rapport du profil du match AVEC les effets sur
 *      le profil du même alignement SANS eux — les nombres mêmes que le moteur
 *      joue, bornes comprises (pression, finition, indiscipline) ;
 *   3. une borne qui mord se voit : un effet qui pousserait les tirs au-delà de
 *      PRESSION_MAX n'est pas annoncé plus fort que ce que le moteur jouera ;
 *   4. les mots affichés sont ces nombres, au pour cent près ;
 *   5. lire les totaux chaque matin ne change pas une seule journée.
 *
 *   node scripts/check_totaux.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJournee, jouerJusqua, bilanLigue,
  totauxDuSoir, motsDesTotaux, profilMatch, activeLineup, effetDeMoment, effetsActifs, flechesDe, CARTES, ROULEMENTS, roulementDe } from '../js/sim.js';
import { PATRONS, payloadDe } from '../js/banque.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

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
const CANAUX = ['volume', 'finition', 'defense', 'discipline'];
const pres = (a, b) => Math.abs(a - b) < 1e-12;

/* Le profil du match avec les effets (et les décisions du jour posées), puis sans aucun. */
function rapportDuMoteur(t, enPlus) {
  const sauve = { cartes: t.cartes, patrons: t.patrons, effets: t.effets };
  const lu = activeLineup(t);
  t.effets = [...(t.effets || []), ...enPlus];
  const avec = profilMatch(t, lu);
  t.cartes = []; t.patrons = []; t.effets = [];
  const sans = profilMatch(t, lu);
  Object.assign(t, sauve);
  return {
    volume: avec.pression / sans.pression,
    finition: avec.finitionFacteur / sans.finitionFacteur,
    defense: avec.traitDef / sans.traitDef,
    discipline: avec.discipline / sans.discipline,
  };
}

console.log('\n  LES TOTAUX DU SOIR\n');

const JOUR = 5;
const decisions = [
  { jour: 0, equipe: 0, carte: 'bloc' },
  { jour: 0, equipe: 0, carte: 'fougue' },
  { jour: 0, equipe: 0, ...payloadDe('patron:att_adjoint') },
  { jour: 0, equipe: 0, ...payloadDe('patron:def_adjoint') },
  { jour: JOUR, equipe: 0, match: { importance: 'haute', ad: 1 } },
];

// 1-4. Une équipe à cinq effets, au matin du jour 5 (la consigne est choisie, pas encore jouée).
{
  const teams = ligue(7700);
  const L = creerLigue(teams, 82, { graine: 'totaux', decisions });
  jouerJusqua(L, JOUR);
  const t = teams[0];
  const aVenir = decisions.filter(d => d.jour === JOUR && (d.equipe || 0) === 0);
  const T = totauxDuSoir(t, null, null, aVenir);

  // 1. Le produit des sources.
  const sources = [...(t.cartes || []).map(c => CARTES[c]), ...(t.patrons || []), ROULEMENTS[roulementDe(t)], ...effetsActifs(t), ...aVenir.map(effetDeMoment).filter(Boolean)];
  const nb = (t.cartes || []).length + (t.patrons || []).length + aVenir.length;
  exiger('l\'équipe porte au moins trois effets à la fois', nb >= 3, `${nb} effets : ${(t.cartes || []).join(', ')} · ${(t.patrons || []).map(p => p.cle).join(', ')} · consigne haute`);
  const produit = Object.fromEntries(CANAUX.map(k => [k, sources.reduce((a, s) => a * ((s && s[k]) ?? 1), 1)]));
  exiger('les effets se multiplient : le total brut est le produit des sources',
    CANAUX.every(k => pres(T.brut[k], produit[k])), CANAUX.map(k => `${k} ${produit[k].toFixed(4)}`).join(' · '));

  // 2. Le total affiché est celui que le moteur joue.
  const R = rapportDuMoteur(t, aVenir.map(effetDeMoment).filter(Boolean));
  exiger('le total affiché égale le rapport du profil du moteur, canal par canal',
    CANAUX.every(k => pres(T[k], R[k])), CANAUX.map(k => `${k} ${T[k].toFixed(4)} = ${R[k].toFixed(4)}`).join(' · '));

  // 4. Les mots.
  const mots = motsDesTotaux(T).map(m => m.txt);
  const attendus = [['volume', 'Tirs'], ['finition', 'Précision'], ['defense', 'Buts contre'], ['discipline', 'Punitions']]
    .filter(([k]) => Math.round((T[k] - 1) * 100) !== 0).map(([k, mot]) => `${mot} ${flechesDe(T[k])}`);
  exiger('les mots affichés sont ces nombres, au pour cent près', mots.join('|') === attendus.join('|'), `Ce soir : ${mots.join(' · ')}`);
  informer('la ligne, telle que l\'écran la montre', `Ce soir : ${mots.join(' · ')}`);

  // La consigne choisie ce matin compte déjà.
  const sansConsigne = totauxDuSoir(t);
  exiger('la consigne choisie ce matin entre dans le total du soir', !pres(sansConsigne.finition, T.finition) && !pres(sansConsigne.defense, T.defense),
    `précision ${flechesDe(sansConsigne.finition)} → ${flechesDe(T.finition)}`);
  exiger('lire les totaux ne touche pas à l\'équipe', !(t.effets || []).some(e => e.source === 'match') && (t.cartes || []).length === 2 && (t.patrons || []).length === 2);

  // 3. Une borne qui mord.
  const gros = [{ jour: JOUR, equipe: 0, effet: { volume: 2.2, duree: 3, nom: 'Test' } }];
  const G = totauxDuSoir(t, null, null, gros);
  const RG = rapportDuMoteur(t, [{ debut: JOUR, fin: JOUR + 3, volume: 2.2 }]);
  exiger('une borne qui mord : le total annoncé reste sous le produit brut', G.volume < G.brut.volume - 0.05,
    `produit ${flechesDe(G.brut.volume)}, joué ${flechesDe(G.volume)}`);
  exiger('… et c\'est exactement ce que le moteur joue', pres(G.volume, RG.volume), `${G.volume.toFixed(4)} = ${RG.volume.toFixed(4)}`);
}

// 5. Lire les totaux chaque matin ne change pas la saison.
{
  const joue = lire => {
    const teams = ligue(7800);
    const L = creerLigue(teams, 82, { graine: 'totaux-rejeu', decisions });
    while (!L.fini) { if (lire) totauxDuSoir(teams[0], null, null, decisions.filter(d => d.jour === L.jour)); jouerJournee(L); }
    bilanLigue(L);
    return teams.map(x => `${x.W}-${x.L}-${x.OTL}-${x.GF}-${x.GA}`).join('|');
  };
  exiger('lire les totaux chaque matin ne change pas une seule journée', joue(true) === joue(false));
}

verdict();
