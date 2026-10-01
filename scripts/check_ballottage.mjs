/*
 * LE BALLOTTAGE SE REJOUE (S66). C'est la seule décision qui fait ENTRER un
 * joueur neuf dans l'alignement — tout le reste permute les mêmes 23 — donc
 * elle a son propre garde-fou :
 *   — la même graine et la même décision rejouent la même saison, au but près ;
 *   — les journées d'AVANT la réclamation sont identiques à la saison sans elle ;
 *   — le joueur réclamé joue vraiment, et celui qu'il remplace ne joue plus ;
 *   — la décision 0 retrouve le libéré (le moteur le connaît par sa clé).
 *
 *   node scripts/check_ballottage.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, simulateLeague, getPlayerKey, getPersonKey, connaitre, photoAlignement, fits } from '../js/sim.js';
import { candidatsBallottage, productionDe, NIVEAU_MAX_BALLOTTAGE, RAPPEL_MATCHS, quiGlisse } from '../js/ballottage.js';
import { niveauDe, joueursParNiveau, groupeDuJoueur } from '../js/niveaux.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const shard = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

function ligue() {
  const out = [];
  for (const f of SAISONS.slice(10, 50)) {
    const sh = shard(f);
    for (const tag of [...new Set(sh.players.map(p => p.t))].slice(0, 2)) {
      let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
      if (un[0].length < 12 || un[1].length < 6 || !un[2].length) continue;
      const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings);
      out.push(createTeam(`${tag} ${sh.season}`, tag, autoRoster(p), { season: sh.season }));
      if (out.length === 16) return out;
    }
  }
  return out;
}

// Un joueur hors ligue : un attaquant d'une autre saison.
const autre = shard(SAISONS[5]).players.find(p => p.p !== 'G' && p.p !== 'D' && p.gp > 40);
registerHiddenRatings(autre);
const iR = SLOTS.find(s => s.scratch && s.role === 'Réserve F').i;

const jouer = avecBallottage => {
  const teams = ligue();
  const toi = teams[0];
  connaitre(autre);
  const d0 = { jour: 0, equipe: 0, cases: photoAlignement(toi.roster) };
  const sort = toi.roster[iR];
  const decisions = [d0];
  if (avecBallottage) decisions.push({ jour: 30, equipe: 0, ballottage: { i: iR, entre: getPlayerKey(autre), sort: sort && getPlayerKey(sort) } });
  const L = simulateLeague(teams, 82, { graine: 'ballottage', decisions });
  const empreinte = j => L.calendrier.slice(0, j).map(jr => jr.map(m => `${m.gfA}-${m.gfB}`).join(',')).join('|');
  return { L, toi, sort, avant: empreinte(30), tout: empreinte(Infinity) };
};

const sans = jouer(false), avec = jouer(true), encore = jouer(true);
exiger('la même réclamation rejoue la même saison', avec.tout === encore.tout, 'au but près');
exiger('les 30 journées d\'avant sont celles de la saison sans réclamation', avec.avant === sans.avant, 'identiques');
exiger('la réclamation change la suite', avec.tout !== sans.tout, 'la saison diverge');
exiger('le joueur réclamé est dans l\'alignement', avec.toi.roster[iR] === autre, autre.n);
exiger('le joueur réclamé a joué', (autre.simGP || 0) > 0, `${autre.simGP || 0} matchs`);
exiger('le libéré n\'est plus dans l\'alignement', !Object.values(avec.toi.roster).includes(avec.sort), avec.sort ? avec.sort.n : 'case vide');
/*
 * DES DÉS NEUFS APRÈS CHAQUE DÉCISION (S68). La même décision prise deux fois
 * (deux sels) donne deux suites différentes ; le même sel redonne la même ;
 * et les journées d'avant ne bougent jamais.
 */
const avecSel = sel => {
  const teams = ligue();
  const decisions = [{ jour: 0, equipe: 0, cases: photoAlignement(teams[0].roster) }, { jour: 30, equipe: 0, plan: 'equilibre', sel }];
  const L = simulateLeague(teams, 82, { graine: 'sel', decisions });
  const e = j => L.calendrier.slice(0, j).map(jr => jr.map(m => `${m.gfA}-${m.gfB}`).join(',')).join('|');
  return { avant: e(30), tout: e(Infinity) };
};
const s1 = avecSel('a'), s2 = avecSel('b'), s1b = avecSel('a');
exiger('la même décision avec un autre sel rejoue AUTREMENT la suite', s1.tout !== s2.tout, 'deux saisons différentes');
exiger('le même sel redonne la même saison (la sauvegarde)', s1.tout === s1b.tout, 'au but près');
exiger('les journées d’avant ne bougent pas', s1.avant === s2.avant, 'identiques');

/*
 * UN DÉPANNEUR, PAS UNE VEDETTE (1.0, J1-D). Les candidats viennent de la
 * fonction pure (js/ballottage.js) : sur vingt blessures rejouées dans une
 * ligue de seize clubs, chaque candidat est au plus un Régulier de sa saison
 * (jamais un Pilier, une Étoile, un Phénomène), un patineur fait au plus
 * 0,9 point par match, et la même blessure offre les mêmes trois noms.
 */
{
  const teams = ligue();
  const cles = teams.map(t => `${t.season}|${t.tag}`);
  const shards = new Map();
  for (const f of SAISONS) { const sh = shard(f); const byTeam = {}; for (const p of sh.players) (byTeam[p.t] = byTeam[p.t] || []).push(p); shards.set(sh.season, { players: sh.players, byTeam }); }
  const L = { cles, teams, graine: 'ballottage' };
  const budget = 95_500_000 * 0.03;
  let n = 0, vedettes = 0, gros = 0, vides = 0, instables = 0, offerts = [], meilleurs = 0, horsRappel = 0;
  // Rapportée aux réguliers de sa saison à son poste, comme js/ballottage.js la juge.
  const reguliers = (sa, g) => { const e = shards.get(String(sa)); const v = e ? e.players.filter(x => (x.gp || 0) >= 40 && groupeDuJoueur(x) === g).map(productionDe) : []; return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
  const relative = p => (p.p === 'G' ? productionDe(p) : productionDe(p) / (reguliers(p.s, groupeDuJoueur(p)) || 1));
  for (let i = 0; i < 20; i++) {
    const t = teams[i % teams.length];
    const blesse = Object.values(t.roster).filter(Boolean)[(i * 7) % 20];
    const a = candidatsBallottage({ shards, ligue: L, blesse, budget, at: 10 + i });
    const b = candidatsBallottage({ shards, ligue: L, blesse, budget, at: 10 + i });
    if (!a.length) { vides++; continue; }
    if (a.map(getPlayerKey).join() !== b.map(getPlayerKey).join()) instables++;
    for (const p of a) {
      n++;
      if (relative(p) >= relative(blesse)) meilleurs++;
      if ((p.gp || 0) < RAPPEL_MATCHS[0] || (p.gp || 0) > RAPPEL_MATCHS[1]) horsRappel++;
      const e = shards.get(String(p.s));
      if (!e || niveauDe(p, e.players) > NIVEAU_MAX_BALLOTTAGE) vedettes++;
      // Pas un seuil absolu (un régulier de 1981-82 fait 1,0 point par match) : sous le PLUS FAIBLE Pilier de sa saison, à son poste.
      if (p.p !== 'G' && e) {
        const piliers = joueursParNiveau(e.players)[2].filter(x => groupeDuJoueur(x) === groupeDuJoueur(p)).map(productionDe);
        if (piliers.length && productionDe(p) >= Math.min(...piliers)) gros++;
      }
      if (offerts.length < 3) offerts.push(`${p.n} ${p.s} (${p.gp} m, ${productionDe(p).toFixed(2)}/m, ${p.$ / 1e6} M$)`);
    }
  }
  informer('des candidats vus', offerts.join(' · '));
  exiger('vingt blessures : jamais un Pilier, une Étoile ni un Phénomène au ballottage', n >= 30 && vedettes === 0, `${n} candidats, ${vedettes} au-dessus de Régulier, ${vides} blessures sans offre`);
  exiger('un patineur réclamé produit moins que le plus faible Pilier de sa saison, à son poste', gros === 0, `${gros} au-dessus`);
  exiger('la même blessure offre les mêmes trois noms', instables === 0, `${instables} offres qui changent`);
  // UN VRAI RAPPEL (1.0, oct.) : jamais meilleur que le blessé, et un gars qui a peu joué dans sa saison.
  exiger('jamais un réclamé meilleur que le blessé', meilleurs === 0, `${meilleurs} au-dessus`);
  exiger(`un réclamé a joué de ${RAPPEL_MATCHS[0]} à ${RAPPEL_MATCHS[1]} matchs dans sa saison`, horsRappel === 0, `${horsRappel} hors de la fourchette`);
}
/*
 * KESSEL ARRIVE, OLEKSIAK SORT D'UNE RÉSERVE DE DÉFENSEUR (1.0, oct.). JP :
 * *ça me permet pas de le mettre dans l'alignement*. L'attaquant qui cède sa
 * case ne peut pas glisser à une réserve de défenseur : il va ailleurs
 * (`quiGlisse`), et toute case d'attaquant reste offerte à l'arrivant.
 */
{
  const t = ligue()[0];
  const A = SLOTS.find(s => s.scratch && s.role === 'Réserve D');
  const casesF = SLOTS.filter(s => !s.scratch && s.group === 'F' && t.roster[s.i]);
  // Comme chez JP : une case de réserve d'attaquant libre (sinon l'arrivant n'aurait aucune case, et l'étape un le grise).
  const roster = { ...t.roster };
  delete roster[SLOTS.find(s => s.scratch && s.role === 'Réserve F').i];
  const coups = casesF.map(B => quiGlisse(roster, A, B));
  const offertes = coups.filter(Boolean).length;
  const justes = coups.filter(Boolean).every(g => g.every(([x, sl]) => fits(x, sl)));
  exiger('le sortant d\'une réserve de défenseur laisse toutes les cases d\'attaquant à l\'arrivant', offertes === casesF.length, `${offertes} / ${casesF.length} cases offertes`);
  exiger('celui qui glisse joue toujours une case à sa position', justes, coups.filter(Boolean).flat().map(([x, sl]) => `${x.n} → ${sl.role}`).slice(0, 4).join(' · '));
}
verdict('Le ballottage et les dés neufs');
