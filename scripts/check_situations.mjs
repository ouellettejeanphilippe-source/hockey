/*
 * CE QU'UNE SITUATION VAUT — et pourquoi le contrat se mesure sur une équipe
 * QUI NE RÉAGIT PAS.
 *
 * JP : *x joueur vit telle situation personnelle, bonus ou malus, mais que ça
 * s'équilibre, genre, pas que ça boost ou chie l'équipe, juste que ça change
 * le vibe et force équipe différente*. Le contrat tient donc en deux moitiés,
 * et elles se vérifient séparément :
 *
 *   LA FORCE NE BOUGE PAS — le système lit zéro victoire d'écart net.
 *   LE VIBE BOUGE         — les joueurs, eux, changent franchement de saison.
 *
 * Une mécanique qui ne réussirait que la première serait morte ; une qui ne
 * réussirait que la seconde serait le « boost ou chie » que JP refuse.
 *
 * POURQUOI « UNE ÉQUIPE QUI NE RÉAGIT PAS ». L'IA ne remanie jamais son
 * alignement : ce qu'une paire vaut chez elle est exactement ce qu'elle vaut
 * quand on la SUBIT. C'est le seul chiffre honnête — tout ce qu'un joueur
 * humain en tire ensuite vient de sa réaction, pas du cadeau. Si ce chiffre
 * était positif, le jeu offrirait des victoires ; négatif, il les volerait.
 *
 * ET LA MESURE EST NETTE, là où celle des cartes doit ruser. Une situation ne
 * consomme AUCUN hasard (elle se tire de la graine, de la journée et du rang
 * de l'équipe), donc `situations: false` rejoue la même saison à un facteur
 * près : chaque équipe est son propre témoin, au même calendrier, avec les
 * mêmes dés. Pas de paires pair/impair, pas de bruit d'appariement.
 *
 *   node scripts/check_situations.mjs
 *   LIGUES=8 node scripts/check_situations.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, getPersonKey,
         SITUATIONS, JOURS_SITUATIONS, situationsDuJour, SLOTS, CARTES, mainDeCartes } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 6);

const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };

function ligue(seed) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < 32) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)];
    const sh = shard(f);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || !un[2].length) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}

const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const err = a => { const m = moy(a); return Math.sqrt(moy(a.map(x => (x - m) ** 2)) / (a.length || 1)); };
const signe = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);
const cle = p => p._rk || p.n;

const TOUTES = { ...SITUATIONS };

/*
 * UNE LIGUE EST À SOMME NULLE, et c'est ce qui a failli produire un garde-fou
 * vide. Avec les situations chez TOUT LE MONDE, la moyenne des victoires
 * gagnées vaut zéro par identité — une victoire prise est une victoire perdue
 * — et la moyenne des buts pour égale celle des buts contre pour la même
 * raison. Le premier jet de ce script mesurait ça, lisait « +0,00 victoire »
 * et déclarait l'équilibre : il aurait affiché le même zéro avec des facteurs
 * dix fois trop gros. Les deux moitiés pesées séparément lisaient +0,00 elles
 * aussi, ce qui est arithmétiquement impossible pour deux effets réels — et
 * c'est ce chiffre-là qui a vendu la mèche.
 *
 * On traite donc la MOITIÉ des équipes (les rangs pairs), puis l'autre, comme
 * `check_cartes.mjs` : chaque équipe est mesurée avec et sans, contre le même
 * champ, et le traitement peut enfin prendre quelque chose à quelqu'un. Les
 * situations ne consommant aucun hasard, l'appariement est en prime parfait.
 */
function passe(L, table = null) {
  if (table) {
    for (const k of Object.keys(SITUATIONS)) delete SITUATIONS[k];
    Object.assign(SITUATIONS, table);
  }
  const bras = [];
  for (const parite of [0, 1]) {
    const teams = ligue(5000 + L);
    // Sans les accidents de carte (S68), qui suivent sinon le même interrupteur :
    // ce sont de vraies mutations, et le témoin ne pouvait plus être nul (S79).
    simulateLeague(teams, 82, { graine: `situ-${L}`, situations: i => i % 2 === parite, accidents: false });
    bras.push(teams.map(t => ({
      W: t.W, GF: t.GF, GA: t.GA,
      situations: t.situations || [],
      pts: new Map(SLOTS.map(s => t.roster[s.i]).filter(Boolean).map(p => [cle(p), p.simPTS || 0])),
    })));
  }
  if (table) { for (const k of Object.keys(SITUATIONS)) delete SITUATIONS[k]; Object.assign(SITUATIONS, TOUTES); }
  // Pour chaque équipe : le bras où elle a vécu ses situations, et l'autre.
  const avec = [], sans = [];
  for (let i = 0; i < 32; i++) {
    avec.push(bras[i % 2 === 0 ? 0 : 1][i]);
    sans.push(bras[i % 2 === 0 ? 1 : 0][i]);
  }
  return { avec, sans };
}

console.log(`\n  ${LIGUES} ligues × 32 équipes · fenêtres aux journées ${JOURS_SITUATIONS.join(', ')}\n`);

/* ---------- 1. LA FORCE NE BOUGE PAS ---------- */
const dv = [], dbp = [], dbc = [];
const dPorte = [], dPese = [];
let fenetres = 0;
for (let L = 0; L < LIGUES; L++) {
  const b = passe(L);
  for (let i = 0; i < 32; i++) {
    dv.push(b.avec[i].W - b.sans[i].W);
    dbp.push(b.avec[i].GF - b.sans[i].GF);
    dbc.push(b.avec[i].GA - b.sans[i].GA);
    fenetres += b.avec[i].situations.length;
    // Le vibe : ce que la situation a fait à l'HOMME, pas au club.
    for (const f of b.avec[i].situations) {
      for (const [bout, bac] of [[f.porte, dPorte], [f.pese, dPese]]) {
        const k = cle(bout.p);
        const a = b.avec[i].pts.get(k), s = b.sans[i].pts.get(k);
        if (a !== undefined && s !== undefined) bac.push(a - s);
      }
    }
  }
}

/*
 * LE TÉMOIN EST UN GARDE-FOU SUR LA MÉTHODE, pas sur le jeu : la table vidée,
 * les deux passages sont la même simulation et l'écart doit être EXACTEMENT
 * zéro. S'il ne l'est pas, ce n'est pas la mécanique qui est en cause, c'est
 * la mesure — et c'est précisément ce contrôle qui manquait au premier jet.
 */
{
  const t = passe(0, { neutrePorte: { nom: '—', ico: '·', sens: 1 }, neutrePese: { nom: '—', ico: '·', sens: -1 } });
  let ecart = 0;
  for (let i = 0; i < 32; i++) ecart += Math.abs(t.avec[i].W - t.sans[i].W) + Math.abs(t.avec[i].GF - t.sans[i].GF);
  exiger('sans effet, les deux passages sont identiques', ecart === 0, `${ecart} d'écart cumulé`);
}

informer('fenêtres vécues', `${fenetres} paires sur ${32 * LIGUES} équipes-saisons (${(fenetres / (32 * LIGUES)).toFixed(2)} par équipe)`);
exiger('chaque équipe vit ses quatre fenêtres', fenetres === 32 * LIGUES * JOURS_SITUATIONS.length
  || fenetres >= 32 * LIGUES * (JOURS_SITUATIONS.length - 1),
  `${(fenetres / (32 * LIGUES)).toFixed(2)} par équipe, attendu ${JOURS_SITUATIONS.length}`);

console.log(`\n  LA FORCE — ce qu'une équipe qui NE RÉAGIT PAS y gagne ou y perd\n`);
console.log(`    écart net            ${signe(moy(dv), 2)} victoire  (± ${err(dv).toFixed(2)}, ${dv.length} équipes)`);
console.log(`    buts pour            ${signe(moy(dbp), 1)}`);
console.log(`    buts contre          ${signe(moy(dbc), 1)}`);

/*
 * LA BORNE EST LE CONTRAT, pas un intervalle inventé. Une demi-victoire sur
 * une saison de 82 : en deçà, la mécanique ne « boost ni ne chie » l'équipe au
 * sens où JP l'entend. Elle est plus serrée que celle des cartes (±1) parce
 * que la mesure est plus nette — pas de bruit d'appariement — et parce qu'une
 * carte est un CHOIX qu'on paie, alors qu'une situation est SUBIE : elle n'a
 * aucune raison de pencher d'un côté.
 */
borne('la force du club ne bouge pas', moy(dv), -0.5, 0.5, 'victoire');

/* ---------- 2. LE VIBE BOUGE ---------- */
console.log(`\n  LE VIBE — ce que la situation fait à L'HOMME\n`);
console.log(`    le porté             ${signe(moy(dPorte), 1)} point  (${dPorte.length} joueurs)`);
console.log(`    le pesé              ${signe(moy(dPese), 1)} point  (${dPese.length} joueurs)`);

/*
 * SI CE CHIFFRE EST PETIT, LA MÉCANIQUE EST MORTE. Une situation qui ne
 * déplace pas la fiche de son homme n'a aucune raison d'exister : personne ne
 * remaniera son alignement pour trois dixièmes de point. Le plancher est
 * mesuré, pas décrété — voir le journal de PLAN.md.
 */
exiger('le porté produit visiblement plus', moy(dPorte) > 1.5, `${signe(moy(dPorte), 1)} point`);
exiger('le pesé produit visiblement moins', moy(dPese) < -1.5, `${signe(moy(dPese), 1)} point`);

/* ---------- 3. LE TIRAGE EST PUR ET STABLE ---------- */
const t1 = ligue(9000), t2 = ligue(9000);
const a = situationsDuJour(t1[0], 'x', JOURS_SITUATIONS[0], 0);
const b2 = situationsDuJour(t2[0], 'x', JOURS_SITUATIONS[0], 0);
exiger('la même graine tire la même paire', !!a && !!b2
  && a.porte.cle === b2.porte.cle && a.pese.cle === b2.pese.cle && cle(a.porte.p) === cle(b2.porte.p),
  a ? `${SITUATIONS[a.porte.cle].nom} · ${a.porte.p.n}` : 'aucune paire');
exiger('hors fenêtre, aucune situation', situationsDuJour(t1[0], 'x', 7, 0) === null, 'journée 7');
exiger('le porté et le pesé ne sont jamais le même homme', !!a && cle(a.porte.p) !== cle(a.pese.p),
  a ? `${a.porte.p.n} · ${a.pese.p.n}` : '—');

/*
 * LE TIRAGE NE SUIT PAS LA CASE, il suit l'HOMME. C'est l'invariant qui rend
 * la réaction possible : on promeut le joueur en feu, la saison se rejoue
 * depuis ce jour-là, et il doit être ENCORE en feu. Un tirage par case
 * désignerait quelqu'un d'autre — réagir effacerait ce à quoi on réagit.
 */
const remanie = ligue(9000)[0];
const r = remanie.roster, tmp = r[0]; r[0] = r[11]; r[11] = tmp;   // 1er trio <-> 4e trio
const apres = situationsDuJour(remanie, 'x', JOURS_SITUATIONS[0], 0);
exiger('remanier l\'alignement ne déplace pas la situation', !!apres && !!a
  && cle(apres.porte.p) === cle(a.porte.p) && cle(apres.pese.p) === cle(a.pese.p),
  apres ? `${apres.porte.p.n} · ${apres.pese.p.n}` : 'aucune paire');

/* ---------- 4. CHAQUE SITUATION, PESÉE SEULE ---------- */
/*
 * On ne déduit rien d'une moyenne où douze situations se mélangent : la table
 * est réduite à UNE paire et la ligue rejouée. Le porté est plus fort que le
 * pesé n'est faible EXPRÈS — il se tire du bas de l'effectif, où un joueur
 * porte deux fois moins de lancers — et c'est la colonne « net » qui doit
 * tomber sur zéro, pas les deux moitiés séparément.
 */
const portes = Object.keys(TOUTES).filter(c => TOUTES[c].sens > 0);
const peses = Object.keys(TOUTES).filter(c => TOUTES[c].sens < 0);

/*
 * LES DEUX MOITIÉS, PESÉES SÉPARÉMENT. C'est la mesure qui décide des
 * amplitudes, et on ne peut pas la déduire du total : un système à +0,00
 * victoire peut très bien être un porté à +1,2 annulé par un pesé à −1,2,
 * ce qui est un équilibre en apparence et deux mécaniques trop fortes en
 * vérité. On remplace donc une famille par une situation NEUTRE (tous ses
 * facteurs à 1) : la paire continue de se tirer, mais un seul des deux bouts
 * agit. La somme des deux moitiés doit retomber sur le total.
 */
const NEUTRE_PORTE = { nom: '—', ico: '·', sens: 1 };
const NEUTRE_PESE = { nom: '—', ico: '·', sens: -1 };
if (process.env.MOITIES) {
  console.log(`\n  LES DEUX MOITIÉS, PESÉES SÉPARÉMENT (${LIGUES} ligues)\n`);
  for (const [quoi, table] of [
    ['les portés seuls', { ...Object.fromEntries(portes.map(c => [c, TOUTES[c]])), neutre: NEUTRE_PESE }],
    ['les pesés seuls', { ...Object.fromEntries(peses.map(c => [c, TOUTES[c]])), neutre: NEUTRE_PORTE }],
  ]) {
    const dw = [], gf = [], ga = [];
    for (let L = 0; L < LIGUES; L++) {
      const b = passe(L, table);
      for (let i = 0; i < 32; i++) {
        dw.push(b.avec[i].W - b.sans[i].W);
        gf.push(b.avec[i].GF - b.sans[i].GF);
        ga.push(b.avec[i].GA - b.sans[i].GA);
      }
    }
    console.log(`    ${quoi.padEnd(18)} ${signe(moy(dw), 2).padStart(6)} V   ${signe(moy(gf), 1).padStart(6)} BP   ${signe(moy(ga), 1).padStart(6)} BC`);
  }
}

if (process.env.PAR_SITUATION) {
  console.log(`\n  CHAQUE PAIRE, PESÉE SEULE (${LIGUES} ligues)\n`);
  for (const cp of portes) for (const cs of peses) {
    const t = { [cp]: TOUTES[cp], [cs]: TOUTES[cs] };
    const d = [];
    for (let L = 0; L < LIGUES; L++) { const b = passe(L, t); for (let i = 0; i < 32; i++) d.push(b.avec[i].W - b.sans[i].W); }
    console.log(`    ${TOUTES[cp].nom.padEnd(22)} + ${TOUTES[cs].nom.padEnd(24)} ${signe(moy(d), 2).padStart(6)} V`);
  }
}

informer('les familles', `${portes.length} portés · ${peses.length} pesés`);

/* ---------- 4 bis. LA LIGUE NE MARQUE PAS PLUS ---------- */
/*
 * UNE LIGUE EST À SOMME NULLE EN VICTOIRES, PAS EN BUTS — et c'est la
 * deuxième moitié du contrat, oubliée au premier jet. Les situations
 * peuvent très bien ne déplacer aucune victoire tout en faisant monter le
 * total des buts de tout le monde : il suffit que les portés ajoutent plus
 * d'offensive que les pesés n'en retirent, ou que la paire de gardiens
 * penche. C'est arrivé, et `check_feuilles.mjs` l'a lu — 3,34 buts par
 * équipe par match au lieu de 3,08 — pendant que l'écart de victoires
 * affichait zéro.
 *
 * On compare donc la ligue ENTIÈRE avec et sans, à graine égale. Les
 * situations ne consommant aucun hasard, c'est la même simulation à un
 * facteur près : l'écart lu est l'effet, sans une once de bruit.
 *
 * La borne est serrée (±0,08 but) parce que le repère d'époque du moteur —
 * « ≈ 3,1 buts par équipe par match » — est un contrat que ce chantier n'a
 * pas le droit de déplacer. Ce n'est pas aux situations de régler le tempo
 * de la ligue ; si le nombre de buts doit bouger, les curseurs sont
 * `LANCERS_BASE` et `CIBLE_PCT_TIR`, et ils se règlent sur cinq ligues.
 */
{
  const lire = avec => {
    let buts = 0, matchs = 0;
    for (let L = 0; L < LIGUES; L++) {
      const teams = ligue(5000 + L);
      simulateLeague(teams, 82, { graine: `situ-${L}`, situations: avec, accidents: false });
      for (const t of teams) { buts += t.GF; matchs += t.games; }
    }
    return buts / matchs;
  };
  const avec = lire(true), sans = lire(false);
  informer('les buts de la ligue', `${avec.toFixed(3)} avec · ${sans.toFixed(3)} sans · ${signe(avec - sans, 3)} par équipe par match`);
  borne('les situations ne déplacent pas le tempo de la ligue', avec - sans, -0.08, 0.08, 'but par équipe par match');
}

/* ---------- 5. LA CASE VIDE ---------- */
/*
 * JP : *pour les blessures, faire que si pas de joueur à la position, carte
 * random pigée*. `activeLineup` promeut le premier réserviste compatible ;
 * quand il n'y en a plus, la case reste vide et le moteur y met un joueur de
 * remplacement. C'est le pire moment d'une saison, et le jeu y TIRE une carte
 * — sans la choisir.
 *
 * LA FRÉQUENCE EST LE RÉGLAGE, et elle se mesure ici plutôt que dans le
 * navigateur : `smoke.mjs` ne peut pas l'exiger, puisqu'une saison sur trois
 * n'en vit aucune et qu'un garde-fou qui rougit une fois sur trois se fait
 * désactiver. Les deux scripts se partagent donc le travail, et c'est écrit
 * des deux côtés : ici la fréquence et la pureté du tirage, là-bas le
 * panneau quand il se présente.
 *
 * L'intervalle est large exprès. Ce qu'il attrape n'est pas un dixième
 * d'épisode : c'est une case vide devenue QUOTIDIENNE (le budget de cartes
 * exploserait, et une carte par semaine ne serait plus un moment) ou
 * DISPARUE (la mécanique serait morte sans que rien ne le dise).
 */
/*
 * ET ELLE SE MESURE SUR DES ÉQUIPES BÂTIES COMME CELLES DU JEU, ce qui n'est
 * PAS ce que `ligue()` rend. `equipeReelle` tronque à douze attaquants et six
 * défenseurs — l'alignement partant, rien de plus — donc ses équipes n'ont
 * AUCUN réserviste et la moindre blessure y ouvre un trou : la première
 * lecture a donné 3,08 épisodes par saison et 98 % des équipes touchées,
 * contre 1,02 et 67 % pour des équipes bâties comme `buildOpponents` les
 * bâtit (tout le club passé à `autoRoster`, qui remplit alors les trois
 * cases de réserve dans 270 cas sur 300). Calibrer la borne sur le premier
 * chiffre aurait été calibrer sur un artefact du banc d'essai.
 */
function ligueComplete(seed) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set(), exclude = new Set();
  let essais = 0;
  while (out.length < 32 && essais++ < 4000) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)];
    const sh = shard(f);
    const par = new Map();
    for (const p of sh.players) { if (!par.has(p.t)) par.set(p.t, []); par.get(p.t).push(p); }
    const tags = [...par.keys()];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    const pool = par.get(tag);
    const estD = p => p.p === 'D' || p.p === 'LD' || p.p === 'RD';
    if (pool.filter(p => p.p === 'F').length < 12 || pool.filter(estD).length < 6 || pool.filter(p => p.p === 'G').length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    const copie = pool.map(p => ({ ...p }));
    copie.forEach(registerHiddenRatings);
    const r = autoRoster(copie, exclude);
    for (const q of Object.values(r)) exclude.add(getPersonKey(q));
    out.push(createTeam(`${tag} ${sh.season}`, tag, r, { season: sh.season }));
  }
  return out;
}

{
  const eps = [];
  let plusGros = 0;
  for (let L = 0; L < LIGUES; L++) {
    const teams = ligueComplete(5000 + L);
    simulateLeague(teams, 82, { graine: `situ-${L}` });
    for (const t of teams) {
      eps.push((t.trous || []).length);
      plusGros = Math.max(plusGros, (t.trous || []).length);
    }
  }
  const parSaison = moy(eps);
  const aucune = eps.filter(x => !x).length / eps.length;
  informer('les cases vides', `${parSaison.toFixed(2)} épisode par équipe-saison · ${(100 * (1 - aucune)).toFixed(0)} % des équipes en vivent au moins un · le pire en a ${plusGros}`);
  borne('la case vide reste un MOMENT', parSaison, 0.4, 2.5, 'épisode par saison');
  exiger('une saison peut se passer sans case vide', aucune > 0.05, `${(100 * aucune).toFixed(0)} % des saisons n'en ont aucune`);
}

/*
 * LA CARTE DU TROU SE TIRE, ET ELLE NE SE RÉPÈTE PAS. Elle passe par
 * `mainDeCartes(graine, 1000 + match, déjà prises)` : donc le tirage est PUR
 * — même graine, même épisode, même carte, ce qui est indispensable puisque
 * encaisser rejoue la saison depuis ce jour-là — et il ne peut pas retendre
 * une carte déjà en main. Le décalage de 1000 sur la journée évite qu'un
 * épisode au match 20 tire la même carte que le palier du jour 20.
 */
{
  const toutesLesCartes = Object.keys(CARTES);
  let faute = null;
  for (let g = 1; g <= 30 && !faute; g++) for (let at = 1; at <= 82; at += 7) {
    const prises = toutesLesCartes.slice(0, 3);
    const a = mainDeCartes(g, 1000 + at, prises)[0];
    const b = mainDeCartes(g, 1000 + at, prises)[0];
    if (a !== b) faute = `graine ${g}, match ${at} : ${a} puis ${b}`;
    else if (prises.includes(a)) faute = `graine ${g}, match ${at} : ${a} est déjà prise`;
    else if (!a) faute = `graine ${g}, match ${at} : aucune carte tirée`;
  }
  exiger('la carte d\'une case vide est pure et jamais déjà prise', !faute, faute || '360 tirages');
  const auPalier = mainDeCartes(7, 20, []);
  const auTrou = mainDeCartes(7, 1000 + 20, []);
  exiger('un épisode au match 20 ne tire pas la carte du palier 20', auPalier[0] !== auTrou[0],
    `palier ${auPalier[0]} · trou ${auTrou[0]}`);
}

verdict('Les situations');
