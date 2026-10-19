/*
 * LE CAHIER NEUF, CARTE PAR CARTE (V10, tranche 2 — js/cahier.js, docs/refonte-v10.md). Chaque carte de duel attend
 * son moment ; on la mesure EN PAIRES (CLAUDE.md) : le même duel, sur les mêmes dés, une fois sans rien jouer, une
 * fois en la jouant à la première période où son moment est vrai — deux copies d'un même vrai club, à domicile et
 * au loin. Une réponse se mesure contre sa jumelle nue, qui contre l'intention sans rien faire d'autre : contrer est
 * le travail du duel (le geste le fait aussi, check_duel) ; la borne vise ce que la carte y ajoute. Une carte d'une soirée (à domicile, en séries, contre ta bête noire…) se mesure par sa jumelle sans
 * moment, jouée en 1re : c'est ce qu'elle fait son soir-là, et ces soirs-là sont rares dans un duel isolé.
 *   1. hors de son moment, rien : une réponse jouée la période d'une autre intention laisse la feuille identique ;
 *   2. dans son moment, la borne de sa rareté : le net en victoires par duel joué, sur une saison où on la jouerait
 *      à chacun de ses `DUELS_SAISON` duels, reste sous commune ±1, peu commune ±1,5, rare ±2,5, légendaire ±4
 *      (un maximum, jamais une cible) ;
 *   3. une rare ou une légendaire se VOIT dans la feuille du duel où on la joue : ±2 tirs (pour, contre ou les
 *      deux), ±0,3 but des deux clubs, ou ±0,5 punition ;
 *   4. chaque coach a ses cartes (quatre ; le Comptable, deux), le départ est neutre et a une réponse par intention ;
 *   5. chaque carte change la forme (V11) : un gain et son prix, des minutes, un joueur nommé ou un pari.
 * `N` : duels par club (500). `FILS` : processus (4). `CARTES=a,b` : quelques cartes seulement.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulerGrosMatch, INTENTIONS, MOMENTS_SI } from '../js/sim.js';
import { CARTES_MATCH, DECK_DEPART } from '../js/combat.js';
import { CAHIER } from '../js/cahier.js';
import { BANQUE } from '../js/banque.js';
import { COACHS } from '../js/coachs.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const N = Number(process.env.N ?? 500);
const FILS = Math.max(1, Number(process.env.FILS ?? 4));
const ICI = fileURLToPath(import.meta.url);
/* Les gros matchs d'une saison de run (scripts/sonde_gros_matchs.mjs : 10,6, de 5 à 14). */
const DUELS_SAISON = 10;
const BORNE_V = { commune: 1, peu: 1.5, rare: 2.5, legendaire: 4 };
const VISIBLE = { tirs: 2, buts: 0.3, punitions: 0.5 };

const equipe = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function deuxClubs(s, t) {
  const un = equipeReelle(s, t);
  const toi = equipe('Toi', t, un, s), adv = equipe('Eux', t, un, s);
  toi.isPlayer = true; toi.courbe = true; adv.courbe = true;
  return { toi, adv };
}
/* Une carte d'une soirée se mesure par sa jumelle sans moment : la même, qui joue tous les soirs. */
const soiree = C => !!C.si && !MOMENTS_SI[C.si].duel;
const JUMELLE = '__jumelle', NUE = '__nue';
/* Ce qu'un duel écrit, vu de ton club. */
function lecture(r, visiteur) {
  const f = r.feuille, moi = visiteur ? 'B' : 'A', eux = visiteur ? 'A' : 'B';
  const somme = a => a.reduce((x, y) => x + y, 0);
  return { v: r.gagne ? 1 : 0, tp: somme(f.tirs[moi]), tc: somme(f.tirs[eux]), bp: r.gf, bc: r.ga,
    pun: f.punitions.filter(p => p.cote === moi).length, empreinte: JSON.stringify([f.buts.map(b => [b.cote, b.instant]), f.tirs, f.punitions.length]) };
}
/* UN FILS DE LA MESURE : chaque carte de `cles`, `n` duels par club témoin, en paires. */
function mesurer(cles, n) {
  const out = {};
  for (const cle of cles) {
    const C = CARTES_MATCH[cle];
    const joue = soiree(C) ? JUMELLE : cle;
    if (joue === JUMELLE) { const { si, ...sans } = C; void si; CARTES_MATCH[JUMELLE] = sans; }
    // Une réponse se mesure contre sa jumelle NUE : la même, qui contre l'intention et ne fait rien d'autre. Contrer, le
    // geste le fait aussi (check_duel) ; ce qu'on borne ici, c'est ce que la carte ajoute.
    const nue = INTENTIONS[C.si] ? NUE : null;
    if (nue) CARTES_MATCH[NUE] = { nom: C.nom, ico: C.ico, cout: C.cout, rarete: C.rarete, genre: C.genre, si: C.si, texte: '' };
    const m = out[cle] = { n: 0, joue: 0, dv: 0, dtp: 0, dtc: 0, dbp: 0, dbc: 0, dpun: 0, hors: 0, horsPareil: 0 };
    for (const [lab, s, t] of TEMOINS) {
      const { toi, adv } = deuxClubs(s, t);
      for (let i = 0; i < n; i++) {
        const visiteur = i % 2 === 1, o = { graine: `cahier-${lab}`, cle: `m${i}`, visiteur };
        let nueJouee = false;
        toi.robotDuel = ({ dansSonMoment }) => (nue && !nueJouee && dansSonMoment(nue) ? ((nueJouee = true), { cartes: [nue] }) : {});
        const sans = lecture(simulerGrosMatch(toi, adv, o), visiteur);
        let deja = false;
        toi.robotDuel = ({ dansSonMoment }) => (!deja && dansSonMoment(joue) ? ((deja = true), { cartes: [joue] }) : {});
        const avec = lecture(simulerGrosMatch(toi, adv, o), visiteur);
        m.n++;
        if (deja) {
          m.joue++; m.dv += avec.v - sans.v; m.dtp += avec.tp - sans.tp; m.dtc += avec.tc - sans.tc;
          m.dbp += avec.bp - sans.bp; m.dbc += avec.bc - sans.bc; m.dpun += avec.pun - sans.pun;
        }
        // 1. Une réponse jouée la période d'une AUTRE intention : rien.
        if (INTENTIONS[C.si] && i % 5 === 0) {
          let ailleurs = false;
          toi.robotDuel = ({ intention }) => (!ailleurs && intention.cle !== C.si ? ((ailleurs = true), { cartes: [cle] }) : {});
          const hors = lecture(simulerGrosMatch(toi, adv, o), visiteur);
          toi.robotDuel = () => ({});
          const rien = lecture(simulerGrosMatch(toi, adv, o), visiteur);
          if (ailleurs) { m.hors++; if (hors.empreinte === rien.empreinte) m.horsPareil++; }
        }
      }
    }
  }
  return out;
}
if (process.env.PART) {
  process.stdout.write(JSON.stringify(mesurer(process.env.PART.split(','), Number(process.env.NPART))));
  process.exit(0);
}

const t0 = Date.now();
const toutes = (process.env.CARTES ? process.env.CARTES.split(',') : Object.keys(CAHIER)).filter(k => CAHIER[k]);
console.log(`\n  Le cahier neuf (V10) · ${toutes.length} cartes · ${N} duels par club et par carte, ${TEMOINS.length} clubs, en paires\n`);

/* ---------- 4 : la forme du cahier ---------- */
{
  const coachDe = k => BANQUE[`match:${k}`] && BANQUE[`match:${k}`].coach;
  const parCoach = {};
  for (const k of Object.keys(CAHIER)) if (!DECK_DEPART.includes(k)) parCoach[coachDe(k) || 'neutre'] = (parCoach[coachDe(k) || 'neutre'] || 0) + 1;
  exiger('chaque coach a ses cartes : quatre, et deux au Comptable', Object.keys(COACHS).every(c => parCoach[c] === (c === 'banque' ? 2 : 4)) && !parCoach.neutre,
    Object.entries(parCoach).map(([c, x]) => `${COACHS[c] ? COACHS[c].ico : c} ${x}`).join(' · '));
  exiger('le départ est neutre, et répond à chaque intention', DECK_DEPART.every(k => CAHIER[k] && !coachDe(k)) && Object.keys(INTENTIONS).every(i => DECK_DEPART.some(k => CAHIER[k].si === i)),
    DECK_DEPART.map(k => `${CAHIER[k].ico} ${CAHIER[k].si || 'tous les soirs'}`).join(' · '));
  exiger('chaque carte du cahier attend un moment que le moteur connaît, ou joue tous les soirs', Object.values(CAHIER).every(C => !C.si || MOMENTS_SI[C.si]),
    `${Object.values(CAHIER).filter(C => C.si).length} cartes d'un moment sur ${Object.keys(CAHIER).length}`);
  /*
   * 5. LA FORME, PAS LA FORCE (V11, docs/refonte-v11.md). JP : *les cartes de match doivent plus changer comment
   * l'équipe joue que donner un bonus* ; *les bonus et malus plus importants touchent des joueurs et non l'équipe*.
   * Une carte d'équipe paie un canal et en coûte un autre (le leur compte à l'envers), ou déplace les minutes des
   * trios ; son gros va à un joueur nommé (`joueur`) ; un pari ou un geste sans canal (piger) en est exempt.
   */
  const bon = (k, v) => (k === 'robustesse' ? v > 0 : ['defense', 'discipline', 'blessure', 'energie'].includes(k) ? v < 1 : v > 1);
  const sens = C => [
    ...Object.entries(C.effet || {}).filter(([k, v]) => typeof v === 'number' && v !== (k === 'robustesse' ? 0 : 1)).map(([k, v]) => bon(k, v)),
    ...Object.entries(C.adv || {}).filter(([, v]) => typeof v === 'number' && v !== 1).map(([k, v]) => !bon(k, v)),
  ];
  const deForme = C => !!(C.pari || C.joueur || (C.effet && (C.effet.F || C.effet.D)) || (s => !s.length || (s.includes(true) && s.includes(false)))(sens(C)));
  const cadeaux = Object.entries(CAHIER).filter(([, C]) => !deForme(C)).map(([k, C]) => `${C.ico} ${C.nom}`);
  exiger('chaque carte change la forme : un gain et son prix, des minutes, un joueur nommé ou un pari', !cadeaux.length,
    cadeaux.join(' · ') || `${Object.values(CAHIER).filter(C => C.joueur).length} sur un joueur, ${Object.values(CAHIER).filter(C => C.effet && (C.effet.F || C.effet.D)).length} sur les minutes`);
}

/* ---------- 1 à 3 : la mesure ---------- */
const lancer = (cles, n) => new Promise((ok, ko) => {
  const p = spawn(process.execPath, [ICI], { env: { ...process.env, PART: cles.join(','), NPART: String(n) } });
  let txt = '';
  p.stdout.on('data', x => { txt += x; });
  p.stderr.on('data', x => process.stderr.write(x));
  p.on('close', c => (c === 0 ? ok(JSON.parse(txt)) : ko(new Error(`le fils ${cles[0]}… a échoué (${c})`))));
});
// Les cartes qui ne jouent qu'en piochant ne se mesurent pas ici : leur effet est la carte qu'elles tirent.
const mesurees = toutes.filter(k => !CAHIER[k].pioche);
const lots = Array.from({ length: FILS }, (_, i) => mesurees.filter((_, j) => j % FILS === i)).filter(l => l.length);
const res = Object.assign({}, ...(await Promise.all(lots.map(l => lancer(l, N)))));

const f1 = x => (x >= 0 ? '+' : '') + x.toFixed(1).replace('.', ',');
const f2 = x => (x >= 0 ? '+' : '') + x.toFixed(2).replace('.', ',');
let hors = 0, horsPareil = 0;
const tropFortes = [], invisibles = [], jamais = [];
for (const k of mesurees) {
  const C = CAHIER[k], m = res[k];
  hors += m.hors; horsPareil += m.horsPareil;
  if (m.joue < 30) { jamais.push(`${C.nom} (${m.joue})`); continue; }
  const par = x => x / m.joue;
  const v = par(m.dv) * DUELS_SAISON;
  const tirs = Math.max(Math.abs(par(m.dtp)), Math.abs(par(m.dtc)), Math.abs(par(m.dtp + m.dtc)));
  const buts = Math.abs(par(m.dbp)) + Math.abs(par(m.dbc));
  const pun = Math.abs(par(m.dpun));
  const vu = tirs >= VISIBLE.tirs || buts >= VISIBLE.buts || pun >= VISIBLE.punitions;
  informer(`${C.ico} ${C.nom} (${C.rarete}${C.si ? `, ${MOMENTS_SI[C.si].mot.toLowerCase()}` : ''})`,
    `jouée ${Math.round((100 * m.joue) / m.n)} % · ${f1(v)} V/saison · tirs ${f1(par(m.dtp))} / contre ${f1(par(m.dtc))} · buts ${f2(par(m.dbp))} / ${f2(par(m.dbc))} · punitions ${f2(par(m.dpun))}`);
  if (Math.abs(v) > BORNE_V[C.rarete]) tropFortes.push(`${C.nom} ${f1(v)} V (borne ${BORNE_V[C.rarete]})`);
  if ((C.rarete === 'rare' || C.rarete === 'legendaire') && !vu) invisibles.push(C.nom);
}
exiger('chaque carte se joue dans son moment assez souvent pour se mesurer', !jamais.length, jamais.join(' · ') || `${mesurees.length} cartes`);
if (mesurees.some(k => INTENTIONS[CAHIER[k].si])) exiger('hors de son moment, une réponse ne change rien à la feuille', hors > 0 && horsPareil === hors, `${horsPareil} feuilles identiques sur ${hors}`);
exiger('dans son moment, chaque carte reste sous la borne de sa rareté', !tropFortes.length, tropFortes.join(' · ') || 'toutes');
exiger('une rare ou une légendaire se voit dans la feuille du duel où on la joue', !invisibles.length, invisibles.join(' · ') || 'toutes');
informer('le temps', `${Math.round((Date.now() - t0) / 1000)} s (${lots.length} fils)`);
verdict();
