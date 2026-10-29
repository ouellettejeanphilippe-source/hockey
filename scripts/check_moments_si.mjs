/*
 * LES MOMENTS (V10, docs/refonte-v10.md § 3 et § 8). JP, 17 oct. : des cartes *plus circonstancielles*. Une carte, un
 * effet ou une modif qui portent `si` ne jouent que le soir où leur moment est vrai (`MOMENTS_SI`, js/sim.js). Ce script
 * en juge trois choses, avant qu'une seule carte neuve n'existe :
 *
 *   1. LA PORTE : un effet d'équipe, une carte, un patron d'un moment ne comptent que si le moment est vrai ce soir ; une
 *      modif de joueur, pareil (`siDe`). Et dans une vraie ligue, un effet d'un moment ne change RIEN avant le premier
 *      soir où son moment arrive : la saison diverge au plus tôt ce soir-là, jamais avant.
 *   2. RIEN D'AVANCE : les moments d'un soir sont ceux d'une ligue jouée jusqu'à lui ; jouée jusqu'au bout, la même
 *      ligue dit les mêmes moments de ce soir-là.
 *   3. CHAQUE MOMENT REVIENT : dans une saison de run (le robot attentif, un club par graine), un moment courant est
 *      vrai pour ton club au moins `MIN_PAR_SAISON` soirs (en médiane) ; un moment rare (les séries, la bête noire, le
 *      duel, qui compte ses périodes) arrive au moins une fois dans les saisons mesurées. Un moment qui n'arrive jamais
 *      ferait une carte morte ; un moment vrai presque tous les soirs n'en est pas un (`PART_MAX`). Un moment `choix` (jouer un blessé) dépend d'un geste que les robots ne font pas : il
 *      est nommé, pas compté.
 *
 *   node scripts/check_moments_si.mjs        (GRAINES=1,2,3,4 par défaut : un club par graine)
 */
import { MOMENTS_SI, effetsDeSaison, autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { jouerSaison, shard, metaAuNiveau } from './lib/rogue_sim.mjs';
import { NIVEAUX_PLEINS } from '../js/rogue.js';
import { exiger, informer, verdict } from './verdict.mjs';

const MIN_PAR_SAISON = 3;
// Un moment vrai presque tous les soirs n'en est pas un : au plus les trois quarts des soirs d'une saison.
const PART_MAX = 0.75;
const GRAINES = (process.env.GRAINES || '1,2,3,4').split(',').map(Number);
const CLES = Object.keys(MOMENTS_SI);
const med = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : 0; };

/* ---------- 1. La porte ---------- */
{
  const fautes = [];
  for (const k of CLES) {
    const T = { effets: [{ debut: 0, fin: 999, si: k, nom: 'essai', finition: 1.2 }, { debut: 0, fin: 999, si: k, nom: 'autre', defense: 0.9 }], jourCourant: 5 };
    T._soir = { [k]: true };
    const oui = effetsDeSaison(T);
    T._soir = { [k]: false };
    const non = effetsDeSaison(T);
    if (Math.abs(oui.finition - 1.2) > 1e-9 || Math.abs(oui.defense - 0.9) > 1e-9) fautes.push(`${k} : son soir, l'effet ne joue pas (${oui.finition}, ${oui.defense})`);
    if (non.finition !== 1 || non.defense !== 1) fautes.push(`${k} : hors de son soir, l'effet joue (${non.finition}, ${non.defense})`);
  }
  exiger('un effet d\'un moment ne joue que son soir', fautes.length === 0, fautes.slice(0, 3).join(' · ') || `${CLES.length} moments`);
}

/* La petite ligue fixe de check_empreinte : des saisons nommées. */
const CLUBS = [['1985-86', 'MTL'], ['1985-86', 'EDM'], ['1995-96', 'DET'], ['1995-96', 'COL'], ['2005-06', 'CAR'], ['2005-06', 'OTT'], ['2015-16', 'PIT'], ['2015-16', 'SJS']];
function ligueFixe(effet = null) {
  const equipes = CLUBS.map(([s, tag], i) => {
    const ps = equipeReelle(s, tag).flat().map(x => ({ ...x }));
    ps.forEach(registerHiddenRatings);
    return createTeam(`${tag} ${s}`, tag, autoRoster(ps), { season: s, isPlayer: i === 0 });
  });
  // Un effet d'un moment, de toute la saison, posé au jour 0 (V21 : le personnel est parti ; une décision `effet` le porte).
  const decisions = effet ? [{ jour: 0, effet: { nom: 'essai', duree: 200, ...effet } }] : [];
  return creerLigue(equipes, 82, { graine: 'moments', decisions });
}
const cote = (m, T) => (m.A === T ? 'A' : 'B');
// Les matchs joués, soir par soir, chacun résumé en une chaîne (le pointage et ses lancers).
function soirs(L) {
  const out = [];
  for (let j = 0; j < L.calendrier.length; j++) for (const m of L.calendrier[j]) {
    if (!m.feuille) continue;
    out.push({ j, m, cle: `${m.A.tag}${m.gfA}-${m.gfB}${m.B.tag}:${(m.feuille.lancers || []).map(l => `${l.instant}${l.but ? 1 : 0}`).join(',')}` });
  }
  return out;
}

/* ---------- 1b. Dans une vraie ligue : rien avant son premier soir ---------- */
{
  const temoin = ligueFixe();
  jouerJusqua(temoin, temoin.calendrier.length);
  const base = soirs(temoin);
  const fautes = [], lus = [];
  for (const k of ['domicile', 'visiteur', 'dosADos', 'jambesLourdes', 'jambesFraiches', 'apresDefaite', 'enFeu', 'infirmerie']) {
    const L = ligueFixe({ si: k, finition: 1.25, volume: 1.15 });
    jouerJusqua(L, L.calendrier.length);
    const club = CLUBS[0][1];
    const ess = soirs(L);
    // Le premier soir où le moment est vrai pour le club 0, dans la ligue avec l'effet.
    const premier = ess.find(x => (x.m.A.tag === club || x.m.B.tag === club) && (x.m.feuille.moments[cote(x.m, x.m.A.tag === club ? x.m.A : x.m.B)] || []).includes(k));
    const diverge = ess.findIndex((x, i) => !base[i] || base[i].cle !== x.cle);
    const jDiv = diverge >= 0 ? ess[diverge].j : null;
    lus.push(`${k} : 1er soir J${premier ? premier.j + 1 : '—'}, diverge J${jDiv !== null ? jDiv + 1 : '—'}`);
    if (jDiv !== null && (!premier || jDiv < premier.j)) fautes.push(`${k} : la saison diverge au J${jDiv + 1}, avant son premier soir (J${premier ? premier.j + 1 : 'jamais'})`);
    if (premier && jDiv === null) fautes.push(`${k} : ses soirs arrivent, et l'effet ne change rien de la saison`);
  }
  informer('le premier soir et la divergence', lus.join(' · '));
  exiger('un effet d\'un moment ne change rien avant son premier soir, et change quelque chose après', fautes.length === 0, fautes.slice(0, 3).join(' · ') || 'huit moments de la ligue ordinaire');
}

/* ---------- 2. Rien d'avance ---------- */
{
  const court = ligueFixe(), long = ligueFixe();
  const J = 30;
  jouerJusqua(court, J + 1);
  jouerJusqua(long, long.calendrier.length);
  const dit = L => (L.calendrier[J] || []).map(m => JSON.stringify(m.feuille && m.feuille.moments)).join('|');
  exiger('les moments d\'un soir sont ceux d\'une ligue jouée jusqu\'à lui', dit(court) === dit(long) && dit(court).length > 0, `J${J + 1} : ${dit(court).slice(0, 120)}`);
}

/* ---------- 3. Chaque moment revient ---------- */
{
  const parMoment = Object.fromEntries(CLES.map(k => [k, []]));
  const clubs = Object.values(shard('2005-06').byTeam).filter(ps => ps.length >= 23);
  const joue = (i, graine) => {
    const joueurs = clubs[i % clubs.length].filter(p => (p.gp || 0) >= 10).map(p => ({ ...p }));
    const etat = { roster: autoRoster(joueurs), variantes: new Map(), jetons: 0 };
    const r = jouerSaison(metaAuNiveau(0), etat, { graine, saison: 1, politique: 'attentif', ligue: NIVEAUX_PLEINS });
    const n = Object.fromEntries(CLES.map(k => [k, 0]));
    let soirsJoues = 0;
    for (const jour of r.L.calendrier) for (const m of jour) {
      if (!m.feuille || (m.A !== r.you && m.B !== r.you)) continue;
      soirsJoues++;
      for (const k of m.feuille.moments[cote(m, r.you)] || []) if (k in n) n[k]++;
      // Le duel : l'intention de chaque période, et la 3e selon le pointage après deux.
      const du = m.feuille.duel;
      if (du && du.periodes) {
        for (const P of du.periodes) if (P.intention && P.intention.cle in n) n[P.intention.cle]++;
        if (du.periodes.length >= 2) {
          const moi = du.periodes[0].pointage.moi + du.periodes[1].pointage.moi, lui = du.periodes[0].pointage.lui + du.periodes[1].pointage.lui;
          n[moi > lui ? 'mene' : moi === lui ? 'egal' : 'derriere']++;
        }
      }
    }
    for (const k of CLES) parMoment[k].push(n[k]);
    parMoment.soirs = [...(parMoment.soirs || []), soirsJoues];
  };
  GRAINES.forEach((g, i) => joue(i, g));
  const somme = a => a.reduce((x, y) => x + y, 0);
  // Les séries se jouent hors du calendrier de la saison (`jouerSaison`) : `check_si` les éprouve (le printemps).
  const courants = CLES.filter(k => !MOMENTS_SI[k].rare && !MOMENTS_SI[k].choix), rares = CLES.filter(k => MOMENTS_SI[k].rare && k !== 'series');
  // UN RARE PEUT MANQUER PAR TIRAGE (oct. 2026) : la chasse est 2 % des périodes de duel (0,3 de score sauf un club sans dur ou
  // un marqueur chaud) ; sur quatre saisons, une graine en donnait deux, un dé de plus dans le moteur zéro. Tant qu'un rare
  // manque, on joue d'autres saisons, quatre au plus : un moment rare qui n'arrive jamais en huit saisons est mort.
  const SAISONS_DE_PLUS = 4;
  for (let g = 1; g <= SAISONS_DE_PLUS && rares.some(k => somme(parMoment[k]) < 1); g++) joue(GRAINES.length + g - 1, GRAINES.length + g);
  informer('les soirs par saison (médiane ; les rares, au total)', [...courants.map(k => `${k} ${med(parMoment[k])}`), ...rares.map(k => `${k} Σ${somme(parMoment[k])}`)].join(' · '));
  informer('dépend d\'un choix du joueur, pas compté', CLES.filter(k => MOMENTS_SI[k].choix).join(', '));
  const peu = courants.filter(k => med(parMoment[k]) < MIN_PAR_SAISON), jamais = rares.filter(k => somme(parMoment[k]) < 1);
  exiger(`chaque moment courant revient au moins ${MIN_PAR_SAISON} fois par saison de run`, peu.length === 0, peu.map(k => `${k} ${med(parMoment[k])}`).join(' · ') || `${courants.length} moments, ${GRAINES.length} saisons`);
  // Le lieu est la moitié des soirs par construction : il n'est pas jugé ici.
  const partout = courants.filter(k => !['domicile', 'visiteur'].includes(k) && med(parMoment[k]) > PART_MAX * med(parMoment.soirs));
  exiger(`aucun moment courant n'est vrai plus des trois quarts des soirs`, partout.length === 0, partout.map(k => `${k} ${med(parMoment[k])} sur ${med(parMoment.soirs)}`).join(' · ') || `sur ${med(parMoment.soirs)} soirs`);
  exiger('chaque moment rare arrive au moins une fois', jamais.length === 0, jamais.join(', ') || `${rares.length} moments rares, ${parMoment.soirs.length} saisons`);
}

verdict('Les moments');
