/*
 * LA MÉTA DU ROGUE (V28, tranche 5, docs/refonte-v28-5.md). Ce qui reste d'une run à l'autre se joue ici sans navigateur :
 * un faux `localStorage` en mémoire, les fonctions du jeu (js/rogue.js, js/club.js, js/coachs-reels.js, js/run.js).
 *
 *   — la variété : trois philosophies ouvertes, cinq à 40, 60, 80, 100 et 120 médailles, refusées s'il en manque ; celle
 *     qu'on vient d'ouvrir a sa case au prochain loto, une carte neuve ;
 *   — ton club : un écusson ou une couleur se paie une fois, se porte ensuite pour rien, un rang de prestige le garde ;
 *   — le prestige : ses médailles gagnées à vie ET son exploit, écrit par la fin d'une run ;
 *   — les exigences : aucun cran avant une Coupe, un de plus par Coupe gagnée au plus haut ; une run porte ses règles, et
 *     ses médailles sont multipliées ;
 *   — le solde, une fois : chaque déblocage d'avant remboursé à son prix d'alors, les médailles à vie intactes ;
 *   — les galons : gravés au cartable une fois par sorte et par run, 24 au plus par carte, chacun son récit ;
 *   — jamais de la force : la même graine joue la même run, que le méta soit vide ou plein.
 *
 *   node scripts/check_meta.mjs            quelques secondes
 */
import fs from 'node:fs';
import { exiger, verdict } from './verdict.mjs';

const memoire = new Map();
globalThis.localStorage = {
  getItem: k => (memoire.has(k) ? memoire.get(k) : null),
  setItem: (k, v) => { memoire.set(k, String(v)); },
  removeItem: k => { memoire.delete(k); },
};
const { lireMeta, ecrireMeta, PRESTIGES, EXIGENCES, PRIME_EXIGENCE, ecussonsAVie, rangDePrestige, voiesOuvertes, prixDeLaVoie, ouvrirUneVoie, payerEcussons,
  exigencesDe, cranOuvert, solderLesDeblocages } = await import('../js/rogue.js');
const { rayonsDuClub, prendreAuClub, nomDuClub } = await import('../js/club.js');
const { LEGENDES, graverAuCartable, legendesDe, ajouterAuCartable, albumDuCartable, coachAuCartable } = await import('../js/cartable.js');
const { lotoDesCoachs } = await import('../js/coachs-reels.js');
const { VOIES } = await import('../js/coachs.js');
const { RUN, creerLaRun, reglesDe } = await import('../js/run.js');
const { jouerLaRun, DONNEES } = await import('./lib/run_robot.mjs');
const COACHS = JSON.parse(fs.readFileSync(new URL('../data/coachs.json', import.meta.url), 'utf8'));
const neuf = (m = {}) => { memoire.clear(); if (m) ecrireMeta({ ...lireMeta(), ...m }); return lireMeta(); };

/* ---------- 1. la variété : les philosophies ---------- */
{
  let m = neuf({ ecussons: 39 });
  const fermees = () => VOIES.filter(v => !voiesOuvertes(lireMeta()).includes(v));
  exiger('trois philosophies sont ouvertes au départ, cinq à ouvrir', voiesOuvertes(m).length === 3 && fermees().length === 5 && VOIES.length === 8, `${voiesOuvertes(m).join(', ')} · ${fermees().length} fermées`);
  const refus = ouvrirUneVoie(fermees()[0]);
  exiger('à 39 médailles, la première (40) se refuse et dit ce qui manque, sans rien écrire', refus.ok === false && refus.manque === 1 && lireMeta().ecussons === 39 && !lireMeta().voies.length, JSON.stringify(refus));
  exiger('une philosophie déjà ouverte, ou inconnue, ne se paie pas', ouvrirUneVoie(voiesOuvertes(m)[0]).ok === false && ouvrirUneVoie('inconnue').ok === false && lireMeta().ecussons === 39);
  ecrireMeta({ ...lireMeta(), ecussons: 400 });
  const prix = [], ordre = fermees().reverse();
  for (const v of ordre) { const r = ouvrirUneVoie(v); prix.push(r.ok ? r.prix : '✗'); }
  m = lireMeta();
  exiger('les cinq s\'ouvrent à 40, 60, 80, 100 et 120 médailles, dans l\'ordre où on les prend : 400 en tout',
    prix.join() === '40,60,80,100,120' && m.ecussons === 0 && voiesOuvertes(m).length === 8 && prixDeLaVoie(m) === null, `${prix.join(' · ')} · il reste ${m.ecussons} 🏅`);
  exiger('la dernière ouverte est la philosophie neuve, et l\'achat survit à une relecture', m.nouvelle === ordre[4] && JSON.parse(memoire.get('cap82_rogue')).voies.join() === ordre.join(), m.nouvelle);
  exiger('acheter ne touche pas aux médailles gagnées à vie', ecussonsAVie({ ecussons: 0, ecussonsAVie: 400 }) === 400);
}

/* ---------- 2. le loto du départ ---------- */
{
  const m = neuf({ ecussons: 40 });
  const cible = VOIES.find(v => !voiesOuvertes(m).includes(v));
  const avant = Array.from({ length: 24 }, (_, g) => lotoDesCoachs(COACHS, voiesOuvertes(m), `g${g}`, 3, {}, null));
  exiger('avant l\'achat, aucun loto ne tire un entraîneur d\'une philosophie fermée', avant.every(l => l.length === 3 && l.every(c => voiesOuvertes(m).includes(c.cle) && !c.nouvelle)),
    `${avant.flat().filter(c => !voiesOuvertes(m).includes(c.cle)).length} carte(s) fermée(s) sur ${avant.flat().length}`);
  ouvrirUneVoie(cible);
  const m2 = lireMeta();
  const apres = Array.from({ length: 24 }, (_, g) => lotoDesCoachs(COACHS, voiesOuvertes(m2), `g${g}`, 3, {}, m2.nouvelle));
  exiger('après l\'achat, chaque loto ouvre sur un entraîneur de la philosophie neuve, marqué « Nouveau », et trois philosophies différentes',
    apres.every(l => l.length === 3 && l[0].cle === cible && l[0].nouvelle === true && l[0].neuf === true && new Set(l.map(c => c.cle)).size === 3 && l.slice(1).every(c => !c.nouvelle)),
    `${apres.filter(l => l[0].cle === cible && l[0].nouvelle).length}/24 lotos`);
  const sans = lotoDesCoachs(COACHS, voiesOuvertes(m2), 'g0', 3, {}, null);
  exiger('la run commencée, la case s\'efface : le loto suivant ne marque plus rien', sans.every(c => !c.nouvelle));
}

/* ---------- 3. ton club ---------- */
{
  // Les médailles gagnées à vie sont posées : sans elles, un vieux méta les lit de sa poche, et la poche pleine monterait le rang.
  let m = neuf({ ecussons: 30, ecussonsAVie: 30 });
  const objet = (r, k) => rayonsDuClub(lireMeta()).find(R => R.cle === r).objets.find(o => o.cle === k);
  const payants = rayonsDuClub(m).flatMap(R => R.objets.filter(o => o.prix && !o.verrou).map(o => ({ ...o, rayon: R.cle }))).sort((a, b) => a.prix - b.prix);
  const pris = payants.find(o => o.rayon === 'club' && o.prix <= 30), cher = payants[payants.length - 1], garde = rayonsDuClub(m).flatMap(R => R.objets.filter(o => o.verrou).map(o => ({ ...o, rayon: R.cle })))[0];
  exiger('le Club vend des écussons et des couleurs, certains gardés par un rang de prestige', !!pris && !!cher && !!garde && rayonsDuClub(m).length === 2,
    `${payants.length} objets payants · ${garde ? `${garde.nom} demande ${garde.verrou}` : 'aucun gardé'}`);
  const r1 = prendreAuClub(pris.rayon, pris.cle), apres1 = lireMeta().ecussons;
  exiger(`un écusson se paie en médailles et se porte : ${pris.nom}, ${pris.prix} 🏅`, r1.ok === true && apres1 === 30 - pris.prix && objet('club', pris.cle).acquis && objet('club', pris.cle).porte && nomDuClub() === pris.nom, `${apres1} 🏅 · ${nomDuClub()}`);
  prendreAuClub('club', 'stars');
  const r2 = prendreAuClub(pris.rayon, pris.cle);
  exiger('acquis, il se reprend pour rien', r2.ok === true && lireMeta().ecussons === apres1 && objet('club', 'stars').porte === false && nomDuClub() === pris.nom, `${lireMeta().ecussons} 🏅`);
  ecrireMeta({ ...lireMeta(), ecussons: cher.prix - 1 });
  const r3 = prendreAuClub(cher.rayon, cher.cle);
  exiger('sans les médailles, il se refuse et dit ce qui manque', r3.ok === false && r3.manque === 1 && lireMeta().ecussons === cher.prix - 1 && !objet(cher.rayon, cher.cle).acquis, JSON.stringify(r3));
  ecrireMeta({ ...lireMeta(), ecussons: 999 });
  const r4 = prendreAuClub(garde.rayon, garde.cle);
  exiger('un objet gardé par un rang se refuse, médailles ou pas, et nomme le rang', r4.ok === false && r4.verrou === garde.verrou && lireMeta().ecussons === 999, JSON.stringify(r4));
  // Les achats d'avant (un nom ou un écusson vendus à part, en jetons à la boutique) restent acquis.
  m = neuf({ ecussons: 0, club: { nom: 'harfangs', pris: ['nom:harfangs', 'ecusson:huard'] } });
  exiger('un nom et un écusson achetés avant la V28 restent acquis', objet('club', 'harfangs').acquis && objet('club', 'huards').acquis && prendreAuClub('club', 'huards').ok === true && lireMeta().ecussons === 0);
}

/* ---------- 4. le prestige et le palmarès ---------- */
{
  neuf();
  const g1 = payerEcussons('runA', 'run', 130.4, { bilan: { pts: 22, ronde: 0, coupe: false, series: false, exigence: 0 } });
  const g2 = payerEcussons('runA', 'run', 130, { bilan: { pts: 22, ronde: 0, coupe: false, series: false, exigence: 0 } });
  let m = lireMeta();
  exiger('une run se paie une fois, arrondie, et compte à vie', g1 === 130 && g2 === 0 && m.ecussons === 130 && ecussonsAVie(m) === 130, `${g1} puis ${g2}`);
  exiger('130 médailles à vie : le deuxième rang', rangDePrestige(m) === 1, PRESTIGES[rangDePrestige(m)].nom);
  payerEcussons('runB', 'run', 400, { bilan: { pts: 20, ronde: 0, coupe: false, series: false, exigence: 0 } });
  m = lireMeta();
  exiger('530 médailles à vie sans avoir joué les séries : le rang ne monte pas', rangDePrestige(m) === 1 && ecussonsAVie(m) === 530, PRESTIGES[rangDePrestige(m)].nom);
  payerEcussons('runC', 'run', 10, { bilan: { pts: 24, ronde: 0, coupe: false, series: true, exigence: 0 } });
  exiger('les séries jouées : le troisième rang', rangDePrestige(lireMeta()) === 2, PRESTIGES[rangDePrestige(lireMeta())].nom);
  payerEcussons('runD', 'run', 700, { bilan: { pts: 26, ronde: 2, coupe: false, series: true, exigence: 0 } });
  m = lireMeta();
  exiger('1 240 médailles, une ronde gagnée et la finale jouée : la Dynastie', rangDePrestige(m) === 4 && m.jalons.ronde && m.jalons.finale, PRESTIGES[rangDePrestige(m)].nom);
  exiger('le palmarès garde la meilleure run : la plus loin en séries, puis les points', m.meilleur.ronde === 2 && m.meilleur.pts === 26 && m.coupes === 0, JSON.stringify(m.meilleur));
  ecrireMeta({ ...m, ecussons: 0 });
  exiger('dépenser ne fait pas baisser le rang', rangDePrestige(lireMeta()) === 4);
}

/* ---------- 5. les exigences ---------- */
{
  let m = neuf();
  exiger('aucun cran avant la première Coupe', cranOuvert(m) === 0);
  const crans = [];
  for (let k = 0; k <= EXIGENCES.length; k++) {
    payerEcussons(`coupe${k}`, 'run', 100, { bilan: { pts: 30, ronde: 3, coupe: true, series: true, exigence: k } });
    crans.push(cranOuvert(lireMeta()));
  }
  exiger('une Coupe ouvre le cran 1, et chaque Coupe gagnée au plus haut cran ouvre le suivant, jusqu\'au dernier', crans.join() === [1, 2, 3, 3].slice(0, EXIGENCES.length + 1).join() && lireMeta().coupes === EXIGENCES.length + 1, crans.join(' · '));
  payerEcussons('coupeBasse', 'run', 100, { bilan: { pts: 30, ronde: 3, coupe: true, series: true, exigence: 0 } });
  exiger('une Coupe gagnée plus bas ne referme rien', cranOuvert(lireMeta()) === EXIGENCES.length);
  const E = [0, 1, 2, 3].map(exigencesDe);
  exiger('chaque cran ajoute sa règle à celles d\'avant : la cible +1, une étape de plus, la cible +2',
    E.map(e => `${e.cible}/${e.etapes}`).join() === '0/0,1/0,1/1,2/1' && exigencesDe(9).n === EXIGENCES.length && exigencesDe(-1).n === 0, E.map(e => `cible +${e.cible}, étapes +${e.etapes}`).join(' · '));
  exiger(`chaque cran paie ${Math.round(PRIME_EXIGENCE * 100)} % de médailles de plus`, E.every((e, k) => Math.abs(e.medailles - (1 + PRIME_EXIGENCE * k)) < 1e-9), E.map(e => `×${e.medailles.toFixed(2)}`).join(' · '));
  const base = creerLaRun(DONNEES, { graine: 'meta', coach: { cle: 'tortue' } }), dure = creerLaRun(DONNEES, { graine: 'meta', coach: { cle: 'tortue' }, exigence: 3 });
  exiger('une run porte ses règles : sans exigence, celles du jeu ; au cran 3, la cible +2 et une étape de plus',
    reglesDe(base.R).cibles.join() === RUN.CIBLES.join() && reglesDe(base.R).etapes.join() === RUN.ETAPES.join() && reglesDe(base.R).prime === 1
    && reglesDe(dure.R).cibles.join() === RUN.CIBLES.map(c => c + 2).join() && reglesDe(dure.R).etapes.join() === RUN.ETAPES.map(e => e + 1).join(),
    `${reglesDe(base.R).cibles.join('-')} · ${reglesDe(dure.R).cibles.join('-')}, étapes ${reglesDe(dure.R).etapes.join('-')}`);
  exiger('une run gardée avant les exigences lit les règles du jeu', reglesDe({}).cibles === RUN.CIBLES && reglesDe(null).prime === 1);
  // Une run jouée au cran 2 : ses actes tenus à la cible montée, ses médailles multipliées.
  const r = jouerLaRun('malin', 3, { exigence: 2 }), R = r.R, brut = R.actes.reduce((a, x) => a + x.medailles, 0) + R.fin.rondes * 20 + (R.fin.coupe ? 40 : 0);
  exiger('une run au cran 2 se juge à sa cible montée et paie ses médailles ×1,30',
    R.actes.every((x, a) => x.cible === RUN.CIBLES[a] + 1 && x.tenu === (x.pts >= x.cible)) && R.fin.medailles === Math.round(brut * 1.3) && brut > 0,
    `${R.actes.map(x => `${x.pts}/${x.cible}`).join(' · ')} · ${brut} → ${R.fin.medailles} 🏅`);
}

/* ---------- 6. le solde des déblocages d'avant ---------- */
{
  const TOUT = ['garder1', 'garder2', 'garder3', 'caisse1', 'caisse2', 'commanditaire1', 'commanditaire2', 'packDefenseurs', 'packGardiens', 'packAnnees80', 'packVedettes', 'plombiersPlus',
    'plafond1', 'plafond2', 'classeur1', 'classeur2', 'classeur3', 'classeur4', 'classeurTri', 'banc1', 'banc2',
    ...['bronze', 'argent', 'or', 'epoque', 'specialistes', 'club', 'coach', 'vedettes'].flatMap(p => [`monte_${p}_1`, `monte_${p}_2`])];
  // Un méta de la V27, tout acheté : 60 médailles en poche, 4 580 gagnées à vie, la Dynastie, une Coupe au cran 5.
  let m = neuf({ jeu: 'v27', ecussons: 60, ecussonsAVie: 4580, deblocages: TOUT, inventaire: { 'consommable:chirurgie': 2 }, cartes: ['x'], recus: { a: 1 }, coupes: 2, exigence: 5,
    jalons: { series: true, ronde: true, finale: true }, runs: 31, club: { club: 'harfangs', pris: ['club:harfangs'] } });
  const rangAvant = rangDePrestige(m), s = solderLesDeblocages();
  m = lireMeta();
  exiger('tout acheté, le solde rend 4 520 médailles, le prix d\'alors de chaque déblocage', !!s && s.rendu === 4520 && s.avant === 60 && m.ecussons === 4580, s ? `${s.avant} + ${s.rendu} = ${m.ecussons} 🏅` : 'aucun solde');
  exiger('il dit ce qu\'il rend, famille par famille, et les familles font le compte', s.familles.length === 9 && s.familles.reduce((a, f) => a + f.prix, 0) === 4520 && s.familles.reduce((a, f) => a + f.n, 0) === TOUT.length,
    s.familles.map(f => `${f.nom} ${f.prix}`).join(' · '));
  exiger('les médailles gagnées à vie et le rang ne bougent pas', ecussonsAVie(m) === 4580 && rangDePrestige(m) === rangAvant && rangAvant === 4, `${ecussonsAVie(m)} à vie · ${PRESTIGES[rangDePrestige(m)].nom}`);
  exiger('les philosophies que la Dynastie ouvrait sont données : les huit, sans rien payer', voiesOuvertes(m).length === 8 && s.voies.length === 5 && prixDeLaVoie(m) === null, s.voies.join(', '));
  exiger('les déblocages, les cartes rares et les reçus partent ; le club, les Coupes et les runs restent',
    !m.deblocages && !m.inventaire && !m.cartes && !m.recus && m.coupes === 2 && m.runs === 31 && m.club.club === 'harfangs' && m.jeu === 'v27', Object.keys(m).join(', '));
  exiger('les crans d\'avant retombent : une Coupe garde le droit au cran 1', m.exigence === 0 && cranOuvert(m) === 1);
  const encore = solderLesDeblocages();
  exiger('une fois : le deuxième solde ne rend rien', encore === null && lireMeta().ecussons === 4580);
  // Un méta d'avant le compte à vie : ce qu'on a plus ce qu'on avait dépensé.
  m = neuf({ ecussons: 15, deblocages: ['caisse1', 'garder1', 'inconnu'] });
  const s2 = solderLesDeblocages();
  exiger('un méta d\'avant le compte à vie : 15 en poche et 70 dépensées font 85 à vie, et 85 en poche après le solde ; une clé inconnue ne rend rien',
    s2.rendu === 70 && lireMeta().ecussons === 85 && ecussonsAVie(lireMeta()) === 85 && s2.voies.length === 0, `${s2.rendu} rendues · ${lireMeta().ecussons} 🏅 · ${ecussonsAVie(lireMeta())} à vie`);
  // Un méta neuf : le solde se fait, sans rien à dire.
  neuf(null);
  const s3 = solderLesDeblocages();
  exiger('un club neuf n\'a rien à solder, et ne le refera pas', !!s3 && s3.rendu === 0 && !s3.familles.length && !s3.voies.length && solderLesDeblocages() === null);
}

/* ---------- 7. les galons, gravés au cartable (tranche 5b) ---------- */
{
  neuf(null);
  const K = '1976-77_MTL_8448782', chapeau = { k: K, type: 'chapeau', extra: 3 };
  const n1 = graverAuCartable([chapeau, { k: K, type: 'dixButs', extra: 10 }, { k: K, type: 'inconnu' }, null], 'runA');
  const n2 = graverAuCartable([chapeau, { k: K, type: 'dixButs', extra: 11 }], 'runA');
  exiger('un galon se grave une fois par sorte et par run, et la carte entre au cartable', n1 === 2 && n2 === 0 && legendesDe(K).length === 2 && JSON.parse(memoire.get('cap82_cartable')).joueurs[K].n === 1, `${n1} puis ${n2} · ${legendesDe(K).map(l => l.type).join(', ')}`);
  const n3 = graverAuCartable([chapeau], 'runB');
  exiger('la run suivante le grave de nouveau, sur la même carte', n3 === 1 && legendesDe(K).filter(l => l.type === 'chapeau').length === 2);
  ajouterAuCartable([{ cle: K, rar: 'rare' }]);
  exiger('une copie de plus de la carte garde ses gravures', legendesDe(K).length === 3 && JSON.parse(memoire.get('cap82_cartable')).joueurs[K].v.rare === 1);
  for (let r = 0; r < 40; r++) graverAuCartable([{ k: K, type: 'jeuBlanc', extra: 30 }], `run${r}`);
  exiger('une carte garde ses 24 gravures les plus récentes', legendesDe(K).length === 24 && legendesDe(K)[23].run === 'run39', `${legendesDe(K).length} gravures`);
  const recits = Object.entries(LEGENDES).flatMap(([t, L]) => [L.recit({ type: t, extra: 4 }), L.recit({ type: t })]);
  exiger('chaque galon a son nom, son icône et un récit qui se lit, même gravé avant la V28 (sans son chiffre)', Object.values(LEGENDES).every(L => L.nom && L.ico) && recits.every(x => typeof x === 'string' && x.length > 5 && !/undefined|null/.test(x)), `${Object.keys(LEGENDES).length} sortes`);
}

/* ---------- 7b. l'Album : le cartable à plat ---------- */
{
  neuf(null);
  exiger('un cartable vide fait un album vide', albumDuCartable().cartes.length === 0 && albumDuCartable().coachs.length === 0 && albumDuCartable().galons === 0);
  ajouterAuCartable([{ cle: '1976-77_MTL_1', rar: 'commune' }, { cle: '1976-77_MTL_2', rar: 'rare' }, { cle: '1984-85_EDM_3', rar: 'commune' }, { cle: '1984-85_EDM_3', rar: 'commune' }, { cle: '1992-93_PIT_4', rar: 'legendaire', num: 12 }]);
  graverAuCartable([{ k: '1976-77_MTL_1', type: 'chapeau', extra: 3 }, { k: '1976-77_MTL_1', type: 'coupe' }], 'r1');
  coachAuCartable({ id: '1976-77_MTL', n: 'Scotty Bowman', cle: 'etoiles', rang: 1, fiche: '60-8-12' }, 1);
  coachAuCartable({ id: '1976-77_MTL', n: 'Scotty Bowman', cle: 'etoiles', rang: 1, fiche: '60-8-12' }, 2);
  coachAuCartable({ id: '1998-99_STL', n: 'Joel Quenneville', cle: 'tortue', rang: 6 }, 3);
  const A = albumDuCartable();
  exiger('l\'Album range les plus belles d\'abord : l\'édition, puis les gravures, puis les copies', A.cartes.map(x => x.k.split('_')[2]).join('') === '4213' && A.cartes[0].ed === 'legendaire' && A.cartes[2].legendes.length === 2 && A.cartes[3].n === 2,
    A.cartes.map(x => `${x.k} ${x.ed} ×${x.n} ${x.legendes.length} gravure(s)`).join(' · '));
  exiger('il compte ses cartes, leurs clubs-saisons et ses galons, sans charger une saison', A.cartes.length === 4 && A.clubs === 3 && A.galons === 2 && A.cartes[1].saison === '1976-77' && A.cartes[1].club === 'MTL');
  exiger('les entraîneurs y sont, les plus joués d\'abord, avec leur club et leur saison', A.coachs.length === 2 && A.coachs[0].n === 'Scotty Bowman' && A.coachs[0].r === 2 && A.coachs[0].tag === 'MTL' && A.coachs[0].saison === '1976-77', A.coachs.map(x => `${x.n} ${x.r} run(s)`).join(' · '));
}

/* ---------- 8. jamais de la force ---------- */
{
  const empreinte = r => JSON.stringify([r.R.fin, r.R.actes, r.R.matchs.map(x => [x.s, x.t, x.gf, x.ga]), r.signatures]);
  neuf(null);
  const vide = empreinte(jouerLaRun('chiffre', 5));
  neuf({ ecussons: 5000, ecussonsAVie: 9000, voies: VOIES.slice(3), nouvelle: VOIES[7], coupes: 4, exigence: 3, jalons: { series: true, ronde: true, finale: true }, club: { club: 'royaux', palette: 'etoiles', pris: ['club:royaux'] }, solde: { vu: true } });
  const plein = empreinte(jouerLaRun('chiffre', 5));
  exiger('la même graine joue la même run, le méta vide ou plein : les médailles n\'achètent aucune force', vide === plein, vide === plein ? `${JSON.parse(vide)[2].length} matchs identiques` : 'la run change avec le méta');
}

verdict();
