/*
 * LE BANC QUI COMPTE (V29, tranche 1 ; docs/refonte-v29.md § 3, § 9 — js/pieces.js). Une pièce de banc compte les badges
 * de tes signés et multiplie un canal du moteur, tout le match, par marches. Ce juge remplace celui du banc à conditions
 * (V27) : ses bornes en victoires, sa présence par soir et le relais sont partis avec lui.
 * Ce qu'on exige :
 *   1. les tables : chaque pièce a son icône, son nom, ce qu'elle compte en rôles connus et en mots, un canal que le
 *      moteur lit (tes tirs, ta précision, les leurs), trois seuils qui montent ; aucune ne porte le nom d'un accord de
 *      ligne ; chaque coach a sa pièce de départ, de sa philosophie, qui compte un rôle de sa couleur ;
 *   2. le compte, pur : un badge compte son palier, le second badge à moitié ; la marche change exactement à son seuil ;
 *      rien sous le premier ; la maîtrise ne règle que la pièce de départ ; deux pièces sur un canal se multiplient et le
 *      produit s'arrête à `BORNE_DU_CANAL` ; une pièce entre dans la première case libre, jamais deux fois ; plein, elle
 *      prend la case de celle qui sort ; trois offertes, pures, jamais une déjà posée ; leur banc en séries ne rétrécit
 *      jamais d'une ronde à l'autre, grandit jusqu'à la finale (`BANC_DES_SERIES`) et prend les pièces les plus avancées chez eux ;
 *   3. les vrais entraîneurs (js/coachs-reels.js) ;
 *   4. EN PAIRES, match par match (CLAUDE.md) : deux copies d'un même vrai club, le même match sur les mêmes dés, une fois
 *      banc vide, une fois avec la pièce seule, à chaque marche. Chaque pièce :
 *        a. sous son premier seuil, ne change rien : la même feuille, aucune note ;
 *        b. à une marche, est notée à la feuille aux trois périodes, avec sa marche et son compte ;
 *        c. se voit dans la feuille, du bon côté : plus de tirs ou de buts pour toi, moins pour eux, et davantage à la
 *           troisième marche qu'à la première (`MESURE`, à `N` matchs : le bruit d'un petit N le fausserait) ;
 *   5. à l'écran (js/impact.js `lignesDeLaPiece`), chaque pièce se dit en vraies stats de match à chaque marche, jamais
 *      en pourcentage, même pour un club déjà à sa borne de style.
 * `N` : matchs par club, par pièce et par marche (200 ; cinq minutes). `MESURE=0 N=20` (la CI, quelques secondes) : 1, 2, 3,
 * 4a et 4b, sans les chiffres de 4c. Ce que le banc vaut dans une run se juge ailleurs : `mesure_run`.
 */
import fs from 'node:fs';
import { autoRoster, registerHiddenRatings, createTeam, playGame, grainerHasard, feuilleVierge, AFFINITES, badgesDe } from '../js/sim.js';
import { PIECES, PIECE_DU_COACH, CASES_DU_BANC, PIECES_OFFERTES, MARCHES, BORNE_DU_CANAL, BANC_DES_SERIES, bancDe, poserLaPiece, piecesOffertes, forceDeLaPiece,
  apportDe, compteDe, marcheDe, seuilSuivant, facteurDe, bancDuMatch, persoAdverse } from '../js/pieces.js';
import { maitriseDu, niveauDuCoach, carteDuCoach, lotoDesCoachs, DU_CARTABLE } from '../js/coachs-reels.js';
import { NIVEAUX, groupeDuJoueur } from '../js/niveaux.js';
import { COACHS, VOIES, COACH_DU_ROLE } from '../js/coachs.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { lignesDeLaPiece, poserClubLu } from '../js/impact.js';
import { exiger, informer, verdict } from './verdict.mjs';
import '../js/greffes.js';   // V25 : les greffes du Rogue se branchent sur le moteur

const N = Number(process.env.N ?? 200);
/* `MESURE=0` (la CI) : sans les chiffres de valeur, que le bruit d'un petit N fausserait. */
const MESURE = process.env.MESURE !== '0';
const QUELLES = process.env.PIECES ? process.env.PIECES.split(',') : Object.keys(PIECES);
const GENRES = new Set(['attaque', 'defense', 'tactique', 'synergie']);
const somme = a => (a || []).reduce((x, y) => x + y, 0);

/* ---------- 1. les tables ---------- */
{
  const fautes = [], accords = new Set(AFFINITES.map(a => a.nom));
  const roles = new Set(Object.entries(COACH_DU_ROLE).flatMap(([g, r]) => Object.keys(r).map(k => `${g}:${k}`)));
  for (const [k, P] of Object.entries(PIECES)) {
    if (!P.ico || !P.nom || !P.qui || accords.has(P.nom)) fautes.push(`${k} : la forme ou le nom d'un accord`);
    if (!GENRES.has(P.genre) || !(P.cadre >= 0 && P.cadre <= 4) || !COACHS[P.voie]) fautes.push(`${k} : le genre, le cadre ou la voie`);
    if (!Array.isArray(P.compte) || !P.compte.length || P.compte.some(r => !roles.has(r))) fautes.push(`${k} : ce qu'elle compte`);
    if (!['canaux', 'adv'].includes(P.cote) || !['volume', 'finition'].includes(P.canal)) fautes.push(`${k} : son canal`);
    if (!Array.isArray(P.seuils) || P.seuils.length !== MARCHES.length || P.seuils.some((s, i) => !(s > 0) || (i && s <= P.seuils[i - 1]))) fautes.push(`${k} : ses seuils`);
  }
  exiger(`${Object.keys(PIECES).length} pièces, chacune ce qu'elle compte en rôles connus, un canal du moteur, ${MARCHES.length} seuils qui montent, aucun nom d'accord`, !fautes.length && Object.keys(PIECES).length >= 9,
    fautes.slice(0, 4).join(' · ') || Object.values(PIECES).map(P => P.ico).join(''));
  exiger(`${MARCHES.length} marches qui montent, chacune plus que la précédente (la concentration paie)`, MARCHES.every((m, i) => m > 0 && (!i || m > MARCHES[i - 1])) && MARCHES[1] - MARCHES[0] > MARCHES[0] && MARCHES[2] - MARCHES[1] > MARCHES[1] - MARCHES[0], MARCHES.join(' · '));
  // La pièce de départ d'un coach compte au moins un rôle de sa couleur (js/coachs.js `COACH_DU_ROLE`).
  const deSaCouleur = c => PIECES[PIECE_DU_COACH[c]].compte.some(r => { const [g, role] = r.split(':'); return COACH_DU_ROLE[g][role] === c; });
  exiger('chaque coach a sa pièce de départ, de sa philosophie, qui compte un rôle de sa couleur', VOIES.every(c => PIECES[PIECE_DU_COACH[c]] && PIECES[PIECE_DU_COACH[c]].voie === c && deSaCouleur(c)) && Object.keys(PIECE_DU_COACH).length === VOIES.length
    && new Set(Object.values(PIECE_DU_COACH)).size === VOIES.length, VOIES.map(c => `${COACHS[c].ico}${PIECES[PIECE_DU_COACH[c]] ? PIECES[PIECE_DU_COACH[c]].ico : '?'}`).join(' '));
}

/* ---------- les vrais clubs ---------- */
// Chaque joueur s'enregistre une fois, ici : un club neuf par match copie ses joueurs déjà enregistrés (la copie garde sa clé),
// sinon chaque copie entrait dans la liste de sa saison (`joueursDeLaSaison`, js/sim.js) et la mesure pleine manquait de mémoire.
const VESTIAIRES = TEMOINS.map(([lab, s, t]) => { const un = equipeReelle(s, t); un.flat().forEach(registerHiddenRatings); return [lab, s, t, un]; });
const club = i => { const [lab, s, t, un] = VESTIAIRES[i]; return createTeam(lab, t, autoRoster(un.flat().map(x => ({ ...x }))), { season: s }); };
const tous = VESTIAIRES.flatMap(([, , , un]) => un.flat());

/* Assez de porteurs pour un compte : le plus petit porteur de la pièce, répété sans dépasser `compte`. */
function porteursPour(cle, compte) {
  const p = tous.filter(x => apportDe(cle, x) > 0).sort((a, b) => apportDe(cle, a) - apportDe(cle, b))[0], out = [];
  while (compteDe(cle, out) + apportDe(cle, p) <= compte) out.push(p);
  return out;
}

/* ---------- 2. le compte, pur ---------- */
{
  // Un joueur à deux badges comptés par deux pièces : le premier à son palier, le second à moitié.
  const fautes = [];
  for (const p of tous.slice(0, 400)) for (const [k, P] of Object.entries(PIECES)) {
    const g = groupeDuJoueur(p), attendu = badgesDe(p).reduce((a, b) => a + (P.compte.includes(`${g}:${b.cle}`) ? (b.second && !b.plein ? b.palier / 2 : b.palier) : 0), 0);
    if (apportDe(k, p) !== attendu) fautes.push(`${p.n} ${k}`);
  }
  const porteurs = k => tous.filter(p => apportDe(k, p) > 0);
  exiger('un badge compte son palier, le second badge à moitié ; chaque pièce a de vrais porteurs', !fautes.length && Object.keys(PIECES).every(k => porteurs(k).length >= 5 && compteDe(k, porteurs(k).slice(0, 3)) === porteurs(k).slice(0, 3).reduce((a, p) => a + apportDe(k, p), 0)),
    fautes.slice(0, 3).join(' · ') || Object.keys(PIECES).map(k => `${PIECES[k].ico} ${porteurs(k).length}`).join(' · '));
  const k0 = 'tireurs', [s1, s2, s3] = PIECES[k0].seuils;
  exiger('la marche change exactement à son seuil, rien sous le premier', marcheDe(k0, s1 - 0.5) === 0 && marcheDe(k0, s1) === 1 && marcheDe(k0, s2 - 0.5) === 1 && marcheDe(k0, s2) === 2 && marcheDe(k0, s3) === 3 && marcheDe(k0, 99) === 3
    && seuilSuivant(k0, 0) === s1 && seuilSuivant(k0, s1) === s2 && seuilSuivant(k0, s3) === null && facteurDe(k0, 0) === 1, `${s1} · ${s2} · ${s3}`);
  const pres = (a, b) => Math.abs(a - b) < 1e-9;
  exiger('ton canal monte de la marche, le leur descend d\'autant ; la maîtrise ne règle que la pièce de départ, de ×0,9 à ×1,3',
    MARCHES.every((m, i) => pres(facteurDe('tireurs', i + 1), 1 + m / 100) && pres(facteurDe('muraille', i + 1), 1 / (1 + m / 100))) && pres(facteurDe('tireurs', 3, 1.3), 1 + 1.3 * MARCHES[2] / 100)
    && forceDeLaPiece({ cle: 'rapaces', maitrise: 1.2 }, 'tireurs') === 1.2 && forceDeLaPiece({ cle: 'rapaces', maitrise: 1.2 }, 'gros') === 1 && forceDeLaPiece({ cle: 'rapaces', maitrise: 2 }, 'tireurs') === 1.3
    && forceDeLaPiece({ cle: 'rapaces', maitrise: 0.5 }, 'tireurs') === 0.9 && forceDeLaPiece({ cle: 'rapaces', maitrise: 1.3, adverse: true }, 'tireurs') === 1);
  // Trois pièces sur tes tirs, toutes à la troisième marche : le produit s'arrête à la borne ; une pièce sous son seuil ne pose rien.
  // Autant de porteurs qu'il en faut pour la troisième marche de chacune, quels que soient ses seuils.
  const beaucoup = ['passeurs', 'gros', 'lignebleue'].flatMap(k => porteursPour(k, PIECES[k].seuils[2] + 0.5)), B = bancDuMatch({ cle: 'essaim', banc: ['passeurs', 'gros', 'lignebleue', 'muraille'], maitrise: 1 }, beaucoup);
  const produit = B.filter(x => x.canaux).reduce((a, x) => a * x.canaux.volume, 1), vide = bancDuMatch({ cle: 'essaim', banc: ['passeurs', 'muraille'] }, []);
  // Deux pièces à leur première marche, sous la borne : le produit exact de leurs deux marches.
  const deux = bancDuMatch({ cle: 'essaim', banc: ['passeurs', 'gros'], maitrise: 1 }, [...porteursPour('passeurs', PIECES.passeurs.seuils[0]), ...porteursPour('gros', PIECES.gros.seuils[0])]);
  exiger(`deux pièces sur un canal se multiplient, et le produit s'arrête à ×${BORNE_DU_CANAL} ; sous son seuil, une pièce ne pose rien`, B.slice(0, 3).every(x => x.marche === 3) && pres(produit, BORNE_DU_CANAL) && pres(B[0].facteur, 1 + MARCHES[2] / 100)
    && deux.every(x => x.marche >= 1) && pres(deux[0].facteur * deux[1].facteur, facteurDe('passeurs', deux[0].marche) * facteurDe('gros', deux[1].marche)) && vide.every(x => x.n === 0 && x.marche === 0 && x.facteur === 1 && !x.canaux && !x.adv), `×${produit.toFixed(2)} pour ×${((1 + MARCHES[2] / 100) ** 3).toFixed(2)} sans borne`);
  const b1 = poserLaPiece(['tireurs'], 'gros'), b2 = poserLaPiece(b1, 'gros'), plein = ['tireurs', 'gros', 'passeurs', 'muraille', 'etouffoir'];
  exiger(`${CASES_DU_BANC} cases : une pièce entre dans la première libre, jamais deux fois ; plein, elle prend la case de celle qui sort, sans elle rien ne bouge`,
    b1.join() === 'tireurs,gros' && b2.join() === b1.join() && poserLaPiece(plein, 'manieurs', 'passeurs').join() === 'tireurs,gros,manieurs,muraille,etouffoir'
    && poserLaPiece(plein, 'manieurs').join() === plein.join() && poserLaPiece(plein, 'manieurs', 'inconnue').join() === plein.join() && poserLaPiece(['tireurs'], 'inconnue').join() === 'tireurs'
    && bancDe({ banc: [...plein, 'manieurs'] }).length === CASES_DU_BANC && bancDe({ banc: ['tireurs', 'une pièce d\'avant'] }).join() === 'tireurs', poserLaPiece(plein, 'manieurs', 'passeurs').join(' · '));
  const P = { cle: 'tortue', banc: ['deuxsens', 'gros'] };
  const a = piecesOffertes(P, 'g', 'camp:0'), b = piecesOffertes(P, 'g', 'camp:0'), autres = new Set(Array.from({ length: 40 }, (_, g) => piecesOffertes(P, `g${g}`, 'camp:0').join()));
  exiger(`${PIECES_OFFERTES} pièces offertes, pures, distinctes, jamais une déjà sur le banc ; deux graines et deux moments n'offrent pas les mêmes`,
    a.length === PIECES_OFFERTES && a.join() === b.join() && new Set(a).size === a.length && !a.some(k => P.banc.includes(k)) && autres.size > 10 && Array.from({ length: 20 }, (_, g) => piecesOffertes(P, `g${g}`, 'camp:1').join() !== piecesOffertes(P, `g${g}`, 'camp:0').join()).some(Boolean),
    `${a.join(', ')} · ${autres.size} offres sur 40 graines`);
  // Leur banc en séries : deux, trois, quatre pièces, les plus avancées chez eux, tout le club compté ; pur.
  const fautesAdv = [];
  for (let i = 0; i < VESTIAIRES.length; i++) {
    const t = club(i), joueurs = Object.values(t.roster).filter(Boolean);
    const rondes = BANC_DES_SERIES.map((n, r) => persoAdverse(t, r));
    if (rondes.some((x, r) => x.banc.length !== BANC_DES_SERIES[r] || !x.adverse || !COACHS[x.cle] || new Set(x.banc).size !== x.banc.length || x.banc.join() !== persoAdverse(t, r).banc.join())) fautesAdv.push(`${VESTIAIRES[i][0]} : la taille`);
    if (rondes[0].banc.some((k, j) => rondes[2].banc[j] !== k)) fautesAdv.push(`${VESTIAIRES[i][0]} : un banc qui change d'une ronde à l'autre`);
    const dehors = Object.keys(PIECES).filter(k => !rondes[2].banc.includes(k)), pire = Math.min(...rondes[2].banc.map(k => marcheDe(k, compteDe(k, joueurs))));
    if (dehors.some(k => marcheDe(k, compteDe(k, joueurs)) > pire)) fautesAdv.push(`${VESTIAIRES[i][0]} : une pièce plus avancée laissée dehors`);
  }
  exiger(`leur banc en séries : ${BANC_DES_SERIES.join(', ')} pièces selon la ronde, les plus avancées chez eux, le même d'un appel à l'autre`, !fautesAdv.length && BANC_DES_SERIES.every((n, i) => n <= CASES_DU_BANC && (!i || n >= BANC_DES_SERIES[i - 1])) && BANC_DES_SERIES.at(-1) > BANC_DES_SERIES[0], fautesAdv.slice(0, 3).join(' · ') || `${VESTIAIRES.length} clubs`);
}

/* ---------- 3. les vrais entraîneurs (js/coachs-reels.js, data/coachs.json) ---------- */
{
  const donnees = JSON.parse(fs.readFileSync(new URL('../data/coachs.json', import.meta.url), 'utf8'));
  const index = JSON.parse(fs.readFileSync(new URL('../data/index.json', import.meta.url), 'utf8')).seasons;
  const cartes = Object.entries(donnees).flatMap(([saison, clubs]) => Object.keys(clubs).map(tag => carteDuCoach(donnees, saison, tag)));
  const fautes = cartes.filter(c => !c || !c.n || !PIECE_DU_COACH[c.cle] || !(c.rang >= 1) || c.maitrise < NIVEAUX[0].maitrise || c.maitrise > NIVEAUX[4].maitrise || c.maitrise !== maitriseDu(c.rang) || !(c.fiche.gp > 0));
  exiger('un vrai entraîneur pour chaque club de chaque saison, une philosophie connue', !fautes.length && index.every(s => donnees[s]) && cartes.length > 1000,
    `${cartes.length} cartes · ${VOIES.map(k => `${k} ${cartes.filter(c => c.cle === k).length}`).join(' · ')}`);
  const bowman = carteDuCoach(donnees, '1976-77', 'MTL');
  exiger('Scotty Bowman, Canadiens 1976-77 : sa fiche, sa Coupe, son Jack Adams', bowman && bowman.n === 'Scotty Bowman' && bowman.fiche.v === 60 && bowman.coupe && bowman.jack, bowman ? `${bowman.n} · ${bowman.cle} · ${bowman.rang}e · ×${bowman.maitrise}` : 'absent');
  exiger('la maîtrise suit le niveau : ★ Phénomène ×1,3 au 1er rang, ★ Étoile ×1,2 aux 3 premiers, Pilier ×1,1 aux 8, Régulier ×1 aux 16, Soutien ×0,9 ensuite',
    [[1, 5, 1.3], [2, 4, 1.2], [3, 4, 1.2], [4, 3, 1.1], [8, 3, 1.1], [9, 2, 1], [16, 2, 1], [17, 1, 0.9], [32, 1, 0.9]].every(([r, n, m]) => niveauDuCoach(r) === n && maitriseDu(r) === m));
  const ouverts = ['tortue', 'essaim', 'rhinos'];
  const a = lotoDesCoachs(donnees, ouverts, 'g'), b = lotoDesCoachs(donnees, ouverts, 'g'), c = lotoDesCoachs(donnees, ouverts, 'h');
  exiger('le loto de l\'entraîneur : trois cartes, trois philosophies ouvertes, pur', a.length === 3 && new Set(a.map(x => x.cle)).size === 3 && a.every(x => ouverts.includes(x.cle))
    && JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c), a.map(x => `${x.n} ${x.saison} ${x.tag}`).join(' · '));
  const siens = { [a[0].id]: { r: 3 }, [a[1].id]: { r: 1 }, [a[2].id]: { r: 2 } };
  const d = lotoDesCoachs(donnees, ouverts, 'h', 3, siens);
  exiger(`le loto tire d'abord dans ton cartable, les moins jouées, ${DU_CARTABLE} au plus, et une carte neuve`,
    d.length === 3 && d.filter(x => !x.neuf).length === DU_CARTABLE && d.filter(x => !x.neuf).every(x => siens[x.id]) && d.some(x => x.neuf && !siens[x.id])
    && d.find(x => !x.neuf).id === a[1].id && new Set(d.map(x => x.cle)).size === 3, d.map(x => `${x.n} ${x.saison}${x.neuf ? ' (neuve)' : ''}`).join(' · '));
}

/* ---------- 4. en paires ---------- */
/*
 * Un match isolé : des clubs neufs, les dés de la graine. `perso` : le banc de ton club ; `comptes` : ceux qui comptent
 * pour lui (la run pose tes signés ; ici, autant de porteurs qu'il en faut pour la marche voulue). Rend la feuille et les
 * chiffres de ton club.
 */
function match(i, j, graine, visiteur, perso, comptes) {
  const toi = club(i), adv = club(j);
  toi.luck = 0; adv.luck = 0;
  toi.perso = perso; toi.comptes = () => comptes;
  toi.jourCourant = 0;
  grainerHasard(graine);
  const f = feuilleVierge();
  const r = visiteur ? playGame(adv, toi, 1, false, false, f) : playGame(toi, adv, 1, false, false, f);
  const moi = visiteur ? 'B' : 'A', eux = visiteur ? 'A' : 'B';
  return { f, moi, gf: visiteur ? r.gfB : r.gfA, ga: visiteur ? r.gfA : r.gfB, tp: somme(f.tirs[moi]), tc: somme(f.tirs[eux]) };
}
{
  const MUET = { cle: '__muet', banc: [] }, lignes = [], fautesA = [], fautesB = [], fautesC = [];
  for (const cle of QUELLES) {
    const P = PIECES[cle], perso = { cle: '__muet', banc: [cle] }, parMarche = [];
    for (let marche = 0; marche <= MARCHES.length; marche++) {
      // Sous le premier seuil : le compte juste dessous ; à une marche : son seuil.
      const comptes = porteursPour(cle, marche ? P.seuils[marche - 1] + 0.5 : P.seuils[0] - 0.5), m = { tp: 0, tc: 0, gf: 0, ga: 0, n: 0 };
      if (marcheDe(cle, compteDe(cle, comptes)) !== marche) { fautesB.push(`${cle} : la marche ${marche} ne se pose pas`); continue; }
      for (let i = 0; i < VESTIAIRES.length; i++) for (let g = 0; g < N; g++) {
        const j = (i + 1 + (g % (VESTIAIRES.length - 1))) % VESTIAIRES.length, graine = `pc${cle}:${i}:${g}`;
        const a = match(i, j, graine, g % 2 === 1, MUET, []), b = match(i, j, graine, g % 2 === 1, perso, comptes);
        const notes = b.f.pieces.filter(x => x.cote === b.moi && x.cle === cle);
        if (!marche) {
          // a. Sous son premier seuil : la même feuille, aucune note.
          if (notes.length || JSON.stringify([a.gf, a.ga, a.f.tirs]) !== JSON.stringify([b.gf, b.ga, b.f.tirs])) fautesA.push(`${cle} ${graine}`);
        } else if (notes.map(x => x.k).join() !== '0,1,2' || notes.some(x => x.marche !== marche || x.n !== compteDe(cle, comptes))) fautesB.push(`${cle} ${graine} : ${notes.length} notes`);   // b. notée aux trois périodes
        m.n++; m.tp += b.tp - a.tp; m.tc += b.tc - a.tc; m.gf += b.gf - a.gf; m.ga += b.ga - a.ga;
      }
      parMarche.push(m);
    }
    // c. Elle se voit, du bon côté, et davantage à la troisième marche qu'à la première : ses tirs, ou les buts.
    if (parMarche.length === MARCHES.length + 1) {
      const lu = m => (P.canal === 'volume' ? (P.cote === 'adv' ? -m.tc : m.tp) : (P.cote === 'adv' ? -m.ga : m.gf)) / m.n, [, m1, , m3] = parMarche.map(lu);
      lignes.push(`${P.ico} ${m1 >= 0 ? '+' : ''}${m1.toFixed(2)} → ${m3 >= 0 ? '+' : ''}${m3.toFixed(2)} ${P.canal === 'volume' ? 'tir' : 'but'}${P.cote === 'adv' ? ' de moins' : ''}`);
      if (!(m3 > 0 && m3 > m1)) fautesC.push(`${cle} : ${m1.toFixed(2)} à la 1re marche, ${m3.toFixed(2)} à la 3e`);
    }
  }
  exiger('sous son premier seuil, une pièce ne change rien : la même feuille, aucune note', !fautesA.length, fautesA.slice(0, 3).join(' · ') || `${QUELLES.length} pièces × ${VESTIAIRES.length * N} matchs`);
  exiger('à une marche, la pièce est notée à la feuille aux trois périodes, avec sa marche et son compte', !fautesB.length, fautesB.slice(0, 3).join(' · '));
  if (MESURE) exiger('chaque pièce se voit dans la feuille, du bon côté, et davantage à la troisième marche qu\'à la première', !fautesC.length, fautesC.slice(0, 3).join(' · ') || lignes.join(' · '));
  else informer('ce que chaque pièce change par match, de la 1re à la 3e marche (jugé à N plein)', lignes.join(' · '));
}
/* ---------- 5. à l'écran : en vraies stats, jamais en pourcentage ---------- */
{
  // Un club lu, et le même à sa borne de style (un effet qui sature sa précision et ses tirs) : la ligne d'une pièce se lit
  // comme le moteur la joue, par-dessus les bornes — sinon elle retombe sur ses mots en %.
  const fautes = [];
  for (const sature of [false, true]) {
    const T = club(0);
    if (sature) T._effetMatch = [{ finition: 1.5, volume: 1.5 }];
    poserClubLu(() => ({ team: T }));
    for (const cle of QUELLES) for (let marche = 1; marche <= MARCHES.length; marche++) {
      const l = lignesDeLaPiece(cle, marche);
      if (!l.length || l.some(x => /%/.test(x.txt)) || !/\d/.test(l[0].txt)) fautes.push(`${cle}, marche ${marche}${sature ? ', club à sa borne' : ''} : « ${l.map(x => x.txt).join(' · ') || 'rien'} »`);
    }
    poserClubLu(null);
  }
  exiger('à l\'écran, chaque pièce se dit en vraies stats de match à chaque marche, jamais en pourcentage — même un club à sa borne de style', !fautes.length, fautes.slice(0, 3).join(' · ') || `${QUELLES.length} pièces × ${MARCHES.length} marches × 2 clubs`);
}
verdict('Le banc qui compte (V29)');
