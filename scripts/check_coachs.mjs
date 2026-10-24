/**
 * LES COACHS (v2, js/coachs.js) — les builds tiennent ce qu'ils promettent.
 *
 *   node scripts/check_coachs.mjs            (LIGUES=6 par défaut, dix minutes : l'équilibre se lit à ±0,4 V)
 *   LIGUES=0 node scripts/check_coachs.mjs   (sans l'équilibre, cinq secondes : la CI)
 *
 * Vérifie :
 *   1. la banque : chaque coach a sa couleur dans au moins trois familles et
 *      assez de cartes pour bâtir (au moins 13), une carte neutre sur cinq environ, et le
 *      coach de quelques cartes témoins se lit comme on l'attend ;
 *   2. la confiance : la 3e, la 6e et la 9e carte d'un coach allument I, II,
 *      III, une seule fois ; le report d'une run et le coach du départ
 *      comptent ; une carte « + » compte pour sa carte de base ;
 *   3. le scaling : une carte de coach grandit avec les cartes de son coach,
 *      jusqu'à son plafond, et la décision porte le chiffre ;
 *   4. la boutique et le plafond : le Comptable change les packs, les jetons
 *      et le plafond comme un patron ; le pack du coach ne tire que sa
 *      couleur, pur ;
 *   5. le moteur : une confiance entre dans `team.coachs`, dans les effets de
 *      la saison et les minutes des trios, et la saison se rejoue ;
 *   6. l'équilibre, EN PAIRES : la confiance I vaut un patron commun, la III
 *      sur un vrai club moins que sur l'équipe bâtie pour elle (check_voies) —
 *      jamais un piège.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, effetsDeSaison, partsDuRoulement, joueursDesCoachs, activeLineup, coachDuJoueur, FAMILLES } from '../js/sim.js';
import { POIDS_TRIO } from '../js/ratings.js';
import { BANQUE, PATRONS, ORDRE_CATEGORIES, buildDe, baseDesCoachs, MATCHS_CONFIANCE, palierAllume, coachsActifs, coachNeuf, coachDeCarte, idsDuCoach, payloadDe, modificateurs, plafondDe, reglesDe } from '../js/banque.js';
import { patronALEchelon } from '../js/echelons.js';
import { COACHS, ORDRE_COACHS, SEUILS, effetDePalier, ROLE_BON, COACH_DU_ROLE, coachDesRoles, porteParSesJoueurs, JOUEUR_COACH, PALIERS_COACH_MAX } from '../js/coachs.js';
import { tirerCartesPack, coachDuPack, niveauxDuPack, tirerJoueursDuPack } from '../js/packs.js';
import { PRESTIGES, rangDePrestige } from '../js/rogue.js';
import { poserClubLu } from '../js/impact.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 6);
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
    if (un[0].length < 12 || un[1].length < 6 || !un[2].length) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const signe = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);
const fiche = t => `${t.W}-${t.L}-${t.OTL} ${t.GF}-${t.GA}`;

console.log('\n  Les coachs (v2)\n');

/* 1. La banque. */
const tous = Object.values(BANQUE);
const neutres = tous.filter(c => !c.coach);
informer('les cartes', `${tous.length} · ${ORDRE_COACHS.map(k => `${COACHS[k].ico} ${idsDuCoach(k).length}`).join(' · ')} · neutres ${neutres.length}`);
// V16 (docs/refonte-v16.md § 5) : le personnel est la seule carte bonus. Les places, l'équipement et les clauses sont
// partis ; chaque coach a au moins cinq adjoints, sur trois postes au moins.
const PLANCHER_COACH = 5, POSTES_COACH = 3;
const adjointsDe = k => idsDuCoach(k).filter(id => BANQUE[id].cat === 'patron' && PATRONS[BANQUE[id].cle]);
const postesDe = k => new Set(adjointsDe(k).map(id => PATRONS[BANQUE[id].cle].role)).size;
const minces = ORDRE_COACHS.filter(k => adjointsDe(k).length < PLANCHER_COACH || postesDe(k) < POSTES_COACH);
exiger(`chaque coach a au moins ${PLANCHER_COACH} adjoints, sur au moins ${POSTES_COACH} postes`, !minces.length,
  ORDRE_COACHS.map(k => `${COACHS[k].nom} ${adjointsDe(k).length}/${postesDe(k)}`).join(' · '));
// v2 (JP : *faudrait quand même des cartes qui sont pas liées à un coach*) : des cartes neutres restent. V13-2 : les dix
// du deck de départ sont parties avec la main du duel ; V16, les places et l'équipement : restent les adjoints neutres et
// les outils de gérant.
borne('les cartes neutres (sans signal, à peine, ou à parts égales)', neutres.length / tous.length, 0.08, 0.3);
// V10 (tranche 6) : l'ancien jeu est parti ; V16, les places, l'équipement et les clauses (75 cartes) : le registre tient
// encore une centaine de cartes ; la tranche 6, la masse salariale, les soins de trop, le congédiement et les rappels :
// le personnel et dix cartes rares.
exiger('le registre : au moins 60 cartes', tous.length >= 60, `${tous.length}`);
const TEMOINS = { 'patron:per_crieurDuBanc': 'essaim', 'patron:per_gardienDuFort': 'tortue', 'patron:per_aumonier': 'choeur', 'patron:per_chefDAtelier': 'profondeur', 'patron:per_metteurEnScene': 'etoiles',
  'patron:per_physioDeRoute': 'souffle', 'patron:per_preparateurCombat': 'rhinos', 'patron:per_tirsDeRoute': 'rapaces', 'patron:per_moine': 'choeur', 'patron:per_macon': 'tortue', 'patron:per_allumeur': 'rapaces' };
const faux = Object.entries(TEMOINS).filter(([id, k]) => coachDeCarte(id) !== k).map(([id, k]) => `${id} → ${coachDeCarte(id)} (attendu ${k})`);
exiger('le coach d\'une carte se lit sur ce qu\'elle fait', !faux.length, faux.join(' · ') || `${Object.keys(TEMOINS).length} témoins`);
exiger('chaque famille a des cartes de coach', ORDRE_CATEGORIES.every(c => tous.some(x => x.cat === c && x.coach)), ORDRE_CATEGORIES.join(' · '));

/*
 * 2. LA CONFIANCE PAR TROIS CHEMINS (V16, docs/refonte-v16.md § 4) : la base (le départ, le report, un coach neuf),
 * puis, par adjoint de sa couleur en poste, 1 point et 1 par échelon, et 1 par tranche de `MATCHS_CONFIANCE` matchs à
 * ton service (doublés à la couleur du coach en poste). Les cartes jouées ne comptent plus.
 */
const unParPoste = k => { const vus = new Set(); return idsDuCoach(k).filter(id => BANQUE[id].cat === 'patron' && !vus.has(PATRONS[BANQUE[id].cle].role) && vus.add(PATRONS[BANQUE[id].cle].role)); };
const engager = (id, jour) => ({ jour, ...payloadDe(id, { patrons: [] }) });
const monter = (id, jour, n) => ({ jour, patron: patronALEchelon(BANQUE[id].cle, { choix: Array(n).fill('force'), depuis: 1 }) });
const jusquA = n => (de, a) => Math.max(0, Math.min(a, n) - de);
{
  const base = [{ jour: 0, coachsDeBase: { tortue: SEUILS[0] }, coach: effetDePalier('tortue', 1) }];
  const T = unParPoste('tortue');
  exiger('la base : le coach du départ à la confiance I, sans personnel', buildDe(base).tortue === SEUILS[0], `${buildDe(base).tortue} points`);
  const un = [...base, engager(T[0], 1)];
  exiger('un adjoint de sa couleur en poste : 1 point ; à son 3e échelon, 3', buildDe(un).tortue === SEUILS[0] + 1 && buildDe([...base, monter(T[0], 1, 2)]).tortue === SEUILS[0] + 3, PATRONS[BANQUE[T[0]].cle].nom);
  const demi = MATCHS_CONFIANCE / 2;
  exiger(`ses matchs à ton service : 1 point par ${MATCHS_CONFIANCE}, doublés à la couleur du coach`, buildDe(un, Infinity, { joues: jusquA(1 + demi) }).tortue === SEUILS[0] + 2
    && buildDe(un, Infinity, { joues: jusquA(demi) }).tortue === SEUILS[0] + 1, `${demi} matchs joués : +1`);
  exiger('les cartes jouées ne comptent plus', buildDe([...base, { jour: 1, joue: { src: 'partie', id: 'joueur:pinceau', ref: 'x' } }]).tortue === SEUILS[0]);
  exiger('une journée à venir ne compte pas encore', buildDe([...base, engager(T[0], 10)], 5).tortue === SEUILS[0]);
  // Le personnel de la Tortue, engagé puis monté échelon après échelon : la confiance s'allume à ses seuils, une fois chacun.
  const pas = [...T.map((id, i) => engager(id, 1 + i)), ...[1, 2, 3, 4].flatMap(n => T.map((id, i) => monter(id, 10 * n + i, n)))];
  const decs = [...base], allumes = [];
  for (const d of pas) { const a = palierAllume(decs, d); if (a) allumes.push(`${buildDe([...decs, d]).tortue}:${a.coach.palier}`); decs.push({ ...d, ...(a || {}) }); }
  exiger(`ses adjoints allument II à ${SEUILS[1]} points et III à ${SEUILS[2]}, une fois chacune`, allumes.join(' ') === `${SEUILS[1]}:2 ${SEUILS[2]}:3`, allumes.join(' ') || 'rien');
  exiger('les confiances actives gardent la plus haute', coachsActifs(decs).length === 1 && coachsActifs(decs)[0].palier === 3);
  // Ses matchs à ton service montent seuls : la décision qui suit, quelle qu'elle soit, allume la confiance atteinte.
  const manque = SEUILS[1] - buildDe(un).tortue, jours = 1 + manque * MATCHS_CONFIANCE / 2;
  const ii = palierAllume(un, { jour: jours }, { joues: jusquA(jours) });
  exiger(`les matchs à ton service allument la II, à la décision qui suit`, !palierAllume(un, { jour: jours - 1 }, { joues: jusquA(jours - 1) }) && !!ii && ii.coach.palier === 2, `${jours - 1} matchs à ton service`);
}

/*
 * 2a. UN SEUL COACH EN POSTE (V5, JP : *juste un coach peut être actif à la fois* ; *choisi au début de la saison,
 * ou changé avec une carte qui enlève l'autre bonus*). Les adjoints d'une autre couleur ne montent personne ;
 * le congédiement (V16 : un dossier du proprio, `laTete` — la décision `coachNeuf`) installe un autre coach à la
 * confiance I, sa base repart, et l'ancien quitte le moteur.
 */
{
  const depart = [{ jour: 0, coachsDeBase: { tortue: SEUILS[0] }, coach: effetDePalier('tortue', 1) }];
  const A = unParPoste('rapaces');
  const decs = [];
  for (const d of [...A.map((id, i) => engager(id, 1 + i)), ...A.map((id, i) => monter(id, 5 + i, 4))]) { const a = palierAllume([...depart, ...decs], d); decs.push({ ...d, ...(a || {}) }); }
  exiger('les adjoints d\'une autre couleur ne changent pas de coach', !decs.some(d => d.coach) && coachsActifs([...depart, ...decs]).map(c => c.cle).join() === 'tortue', coachsActifs([...depart, ...decs]).map(c => `${c.cle} ${c.palier}`).join());
  const cg = coachNeuf('rapaces');
  const apres = [...depart, ...decs, { jour: 20, palier: 'do:3', moment: { famille: 'dossier', cle: 'laTete', choix: 'premier' }, ...cg }];
  const actifs = coachsActifs(apres);
  exiger('le congédiement installe un autre coach à la confiance I, seul', actifs.length === 1 && actifs[0].cle === 'rapaces' && actifs[0].palier === 1 && cg.coachNeuf === true, actifs.map(c => `${c.cle} ${c.palier}`).join());
  exiger('sa base repart à la confiance I ; ses adjoints en poste, eux, comptent', baseDesCoachs(apres).rapaces === SEUILS[0] && buildDe(apres).rapaces === SEUILS[0] + 5 * A.length,
    `base ${baseDesCoachs(apres).rapaces} · ${buildDe(apres).rapaces} points`);
  const ii = palierAllume(apres, engager(A[0], 21));
  exiger('sa prochaine décision de personnel le monte à son palier', !!ii && ii.coach.cle === 'rapaces' && ii.coach.palier >= 2, ii ? `${ii.coach.cle} ${ii.coach.palier}` : 'rien');
  // LE STAGE DU COACH (V16, tranche 6) : la carte rare donne au coach en poste les points qui manquent à son cran suivant.
  const st = payloadDe('consommable:stage', { coach: 'rapaces', points: 3 });
  const avecStage = [...apres, { jour: 22, joue: { src: 'meta', id: 'consommable:stage' }, ...st }];
  exiger('le stage du coach ajoute ses points à la base du coach en poste, et rien sans lui', st && st.coachsDeBase.rapaces === 3 && baseDesCoachs(avecStage).rapaces === SEUILS[0] + 3
    && payloadDe('consommable:stage', {}) === null, st ? JSON.stringify(st) : 'null');
}

/* 2c. Le prestige du club : il ouvre les Étoiles et les Phénomènes, run après run. */
{
  const rangs = [{}, { ecussonsAVie: 200 }, { ecussonsAVie: 400 }, { ecussonsAVie: 400, jalons: { series: 1 } }, { ecussonsAVie: 5000, jalons: { series: 1, ronde: 1, finale: 1 } }].map(rangDePrestige);
  exiger('le prestige demande des écussons à vie ET un exploit à chaque rang', rangs.join(',') === '0,1,1,2,4', rangs.join(', '));
  const lire = (cle, r) => niveauxDuPack(cle, { prestige: PRESTIGES[r] });
  const somme = t => Object.values(t).reduce((a, b) => a + b, 0);
  const or = PRESTIGES.map((_, r) => lire('j:hasard_or', r));
  // V10 (JP : *sans empêcher un random Crosby saison 1*) : le garage tire aux taux de base ; le prestige ajoute, à partir du Club respecté.
  const base = niveauxDuPack('j:hasard_or');
  exiger('au garage, les taux de base (un Phénomène reste possible) ; le prestige ajoute, rang après rang', or[0].phenomene === base.phenomene && base.phenomene > 0
    && or.every((t, r) => !r || (t.etoile >= or[r - 1].etoile && t.phenomene >= or[r - 1].phenomene)) && or[or.length - 1].etoile > base.etoile,
    or.map(t => `${t.etoile.toFixed(1)}/${t.phenomene.toFixed(2)}`).join(' → ') + ' % (Étoile/Phénomène, pack Or)');
  exiger('les taux font toujours 100 %, pack d\'étoiles compris', PRESTIGES.every((_, r) => Math.abs(somme(lire('j:hasard_bronze', r)) - 100) < 1e-9 && Math.abs(somme(lire('j:etoiles', r)) - 100) < 1e-9 && lire('j:etoiles', r).pilier === 0),
    `Étoiles au garage : ${lire('j:etoiles', 0).etoile.toFixed(0)} % d'étoiles, ${lire('j:etoiles', 0).phenomene.toFixed(0)} % de Phénomènes`);
}

/* 2d. Les joueurs ont une couleur, et ils portent leur coach et ses cartes. */
{
  const tousLesRoles = Object.values(COACH_DU_ROLE).flatMap(g => Object.values(g));
  exiger('chaque coach de la glace a des rôles de sa couleur (le Comptable paie, il n\'a pas de joueurs)',
    ORDRE_COACHS.filter(k => k !== 'banque').every(k => tousLesRoles.includes(k)) && !tousLesRoles.includes('banque'), ORDRE_COACHS.map(k => `${COACHS[k].ico} ${tousLesRoles.filter(x => x === k).length}`).join(' · '));
  exiger(`un rôle maîtrisé (${ROLE_BON} et plus) donne sa couleur ; en dessous, aucune`,
    coachDesRoles({ sniper: 80, passeur: 60 }, 'F') === 'rapaces' && coachDesRoles({ sniper: ROLE_BON - 1 }, 'F') === null && coachDesRoles({ defensif: 70, offensif: 40 }, 'D') === 'tortue', 'sniper 80 → Aigle · sniper 54 → aucune · défensif 70 → Tortue');
  const t = ligue(79, 2)[0];
  const n = joueursDesCoachs(t);
  const total = Object.values(n).reduce((a, b) => a + b.joueurs, 0);
  informer('les couleurs d\'une vraie équipe', `${t.name || ''} : ${Object.entries(n).map(([k, v]) => `${COACHS[k].ico} ${v.joueurs} (${v.paliers} paliers)`).join(' · ')} (${total} joueurs de couleur sur 20 habillés)`);
  exiger('une vraie équipe a des joueurs de plusieurs couleurs', Object.keys(n).length >= 3 && total >= 8, `${Object.keys(n).length} couleurs, ${total} joueurs`);
  const k = Object.keys(n).sort((a, b) => n[b].paliers - n[a].paliers)[0];
  const avec = effetsDeSaison({ ...t, coachs: [effetDePalier(k, 3)] }), sans = effetsDeSaison({ ...t, roster: {}, coachs: [effetDePalier(k, 3)] });
  const canal = Object.keys(COACHS[k].paliers[2]).find(c => ['finition', 'defense', 'volume', 'discipline', 'blessure'].includes(c)) || 'robustesse';
  const attendu = porteParSesJoueurs(effetDePalier(k, 3), n[k].paliers)[canal];
  exiger('sa confiance joue plus fort par PALIER de sa couleur habillé (V2.3)', Math.abs((avec[canal] ?? 0) - attendu) < 1e-9 && Math.abs(avec[canal] - (canal === 'robustesse' ? 0 : 1)) > Math.abs(sans[canal] - (canal === 'robustesse' ? 0 : 1)),
    `${COACHS[k].nom} III, ${n[k].joueurs} joueurs, ${n[k].paliers} paliers : ${canal} ${sans[canal].toFixed(3)} sans eux → ${avec[canal].toFixed(3)} (×${(1 + JOUEUR_COACH * n[k].paliers).toFixed(2)} de l'écart)`);
  const un = porteParSesJoueurs(effetDePalier(k, 3), 1), quatre = porteParSesJoueurs(effetDePalier(k, 3), 4), vingt = porteParSesJoueurs(effetDePalier(k, 3), 20);
  // L'écart d'un canal à 1, en puissance (V2.3 : ×0,88 porté deux fois vaut ×0,77) ; la robustesse, une somme, en produit.
  const ec = x => (canal === 'robustesse' ? x[canal] : Math.log(x[canal]));
  const cap = porteParSesJoueurs(effetDePalier(k, 3), PALIERS_COACH_MAX), trop = porteParSesJoueurs(effetDePalier(k, 3), 3 * PALIERS_COACH_MAX);
  exiger(`un Platine compte pour quatre Bronze, jusqu'à ${PALIERS_COACH_MAX} paliers`, Math.abs(ec(quatre) / ec(un) - (1 + 4 * JOUEUR_COACH) / (1 + JOUEUR_COACH)) < 1e-9
    && Math.abs(ec(vingt)) > Math.abs(ec(quatre)) * 1.5 && ec(trop) === ec(cap),
    `1, 4, 20 et ${3 * PALIERS_COACH_MAX} paliers : ${[un, quatre, vingt, trop].map(x => x[canal].toFixed(3)).join(' · ')}`);
}

/* 3. Le scaling : V10 (tranche 6), les cartes qui grandissaient avec celles de leur coach sont parties avec l'ancien jeu ; une carte du jeu neuf frappe dans son moment. */

/* 4. La boutique, le plafond, le pack du coach. */
{
  const d = [{ jour: 2, coach: effetDePalier('banque', 3) }];
  const m = modificateurs(d, 10);
  exiger('le Comptable III : packs −20 %, +3 🪙 par victoire', Math.abs(m.rabais - 0.80) < 1e-9 && m.jetonsVictoire.some(x => x.n === 3 && x.depuis === 2), `rabais ×${m.rabais} · ${JSON.stringify(m.jetonsVictoire)}`);
  const pl = plafondDe(d, 10, { base: 82_000_000 });
  exiger('le Comptable III : plafond +5 %', pl.cap === 82_000_000 + Math.round(82_000_000 * 0.05), `${(pl.cap / 1e6).toFixed(2)} M$`);
  let hors = 0, impurs = 0;
  for (let n = 0; n < 300; n++) for (const k of ORDRE_COACHS) {
    const a = tirerCartesPack('coach', `g${n}`, n, { coach: k });
    if (a.some(id => BANQUE[id].coach !== k)) hors++;
    if (JSON.stringify(a) !== JSON.stringify(tirerCartesPack('coach', `g${n}`, n, { coach: k }))) impurs++;
  }
  exiger('le pack du coach ne tire que sa couleur, et il est pur', !hors && !impurs, `${hors} hors couleur, ${impurs} impur(s) sur ${300 * ORDRE_COACHS.length}`);
  const auHasard = new Set(Array.from({ length: 200 }, (_, n) => coachDuPack('g', n, {})));
  exiger('au hasard, le pack du coach tire tous les coachs', auHasard.size === ORDRE_COACHS.length, `${auHasard.size} coachs sur 200 packs`);
}

/* 5. Le moteur. */
{
  const t = ligue(79, 16), moi = t[0];
  const decs = [{ jour: 5, equipe: 0, coach: effetDePalier('tortue', 3) }, { jour: 6, equipe: 0, coach: effetDePalier('etoiles', 3) }];
  simulateLeague(t, 82, { graine: 'coachs', decisions: decs });
  const e = effetsDeSaison(moi);
  // Portée par ses joueurs habillés ce soir-là (2d) : le Showman par ses passeurs.
  const nj = joueursDesCoachs(moi);
  const f0 = porteParSesJoueurs(effetDePalier('etoiles', 3), (nj.etoiles || {}).paliers).finition;
  // V5 : un seul coach en poste — la confiance du Showman, posée après, remplace celle de la Tortue.
  exiger('une confiance joue pour la saison, et la dernière remplace l\'autre', (moi.coachs || []).length === 1 && moi.coachs[0].cle === 'etoiles' && e.defense === 1 && Math.abs(e.finition - f0) < 1e-9, `${(moi.coachs || []).map(c => c.cle).join(', ')} · buts contre ×${e.defense.toFixed(3)} · précision ×${e.finition.toFixed(3)} (${(nj.etoiles || {}).paliers || 0} paliers de sa couleur)`);
  const parts = partsDuRoulement(POIDS_TRIO, 'F', moi), sans = partsDuRoulement(POIDS_TRIO, 'F', { ...moi, coachs: [] });
  exiger('le Showman donne plus de glace au premier trio', parts[0] > sans[0] && parts[3] < sans[3], `1er trio ${sans[0].toFixed(3)} → ${parts[0].toFixed(3)}`);
  const a = ligue(79, 16), b = ligue(79, 16);
  simulateLeague(a, 82, { graine: 'coachs', decisions: decs });
  simulateLeague(b, 82, { graine: 'coachs', decisions: decs });
  exiger('la saison se rejoue au but près avec les coachs', a.every((x, i) => fiche(x) === fiche(b[i])), `${fiche(a[0])} puis ${fiche(b[0])}`);
}

/* 6. L'équilibre, en paires (voir check_cartes.mjs). */
function paires(fabrique) {
  const dv = [];
  for (let Lg = 0; Lg < LIGUES; Lg++) {
    const bras = [];
    for (const parite of [0, 1]) {
      const teams = ligue(3000 + Lg);
      const decisions = teams.map((_, i) => i).filter(i => i % 2 === parite).flatMap(equipe => fabrique(equipe));
      simulateLeague(teams, 82, { graine: `coachs-${Lg}`, decisions });
      bras.push(teams.map(x => x.W));
    }
    for (let i = 0; i < 32; i++) dv.push(bras[i % 2 === 0 ? 0 : 1][i] - bras[i % 2 === 0 ? 1 : 0][i]);
  }
  return moy(dv);
}
// Sans ligue (LIGUES=0, la CI), l'équilibre se lit à la main.
if (LIGUES > 0) {
  const hors = [], I = [], III = [];
  console.log(`\n  ${LIGUES} ligues × 32 équipes, en paires\n`);
  for (const k of ORDRE_COACHS) {
    if (!Object.keys(COACHS[k].paliers[0]).some(x => x !== 'econ')) continue;   // le Comptable joue à la boutique, pas sur la glace
    const v1 = paires(equipe => [{ jour: 0, equipe, coach: effetDePalier(k, 1) }]);
    const v3 = paires(equipe => [{ jour: 0, equipe, coach: effetDePalier(k, 3) }]);
    I.push(v1); III.push(v3);
    console.log(`  ${COACHS[k].ico} ${COACHS[k].nom.padEnd(16)} I ${signe(v1)} V · III ${signe(v3)} V`);
    if (v1 < -0.8 || v1 > 2.2 || v3 < -0.5 || v3 > 6) hors.push(`${COACHS[k].nom} ${signe(v1)}/${signe(v3)}`);
  }
  /*
   * V2.3 (check_voies) : un vrai club porte un à huit paliers de chaque couleur, donc sa III tombe entre la III
   * sans joueurs (≈ +2 V) et la III sur une équipe bâtie pour elle (+6 à +8 V) — jamais au-dessus de celle-ci.
   */
  exiger('aucune confiance n\'est un piège ni la voie à elle seule (I : −0,8 à +2,2 · III : −0,5 à +6)', !hors.length, hors.join(' · ') || `${I.length} coachs`);
  borne('en moyenne, la confiance I vaut un patron commun', moy(I), -0.2, 1.5, ' V');
  borne('en moyenne, la confiance III sur un vrai club, sous ce qu\'elle vaut sur son équipe', moy(III), 1, 5.5, ' V');
  exiger('la III vaut plus que la I, en moyenne', moy(III) > moy(I), `${signe(moy(I))} → ${signe(moy(III))} V`);
}

/*
 * TOUT SE PARLE (V9). Un coach paie une ou deux familles et en coûte une autre (`familles`, js/coachs.js) : chacune
 * existe, celle qu'il coûte n'est pas une qu'il paie. (V15 : le plan est parti ; ses familles ne disent plus que
 * l'intention qu'un adversaire lui prête au duel.)
 */
{
  const mal = ORDRE_COACHS.filter(k => k !== 'banque').filter(k => {
    const F = COACHS[k].familles;
    return !F || !F.paie.length || !F.paie.every(f => FAMILLES[f]) || !FAMILLES[F.coute] || F.paie.includes(F.coute);
  });
  exiger('chaque coach paie une ou deux familles et en coûte une autre', mal.length === 0,
    mal.map(k => COACHS[k].nom).join(', ') || ORDRE_COACHS.filter(k => COACHS[k].familles).map(k => `${COACHS[k].ico} ${COACHS[k].familles.paie.map(f => FAMILLES[f].nom).join('+')} / −${FAMILLES[COACHS[k].familles.coute].nom}`).join(' · '));
}
{
  // Le dépisteur : sur 60 packs de joueurs, le coach de la run en tire plus de sa couleur qu'un club sans coach.
  const saisons = fs.readdirSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'seasons')).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  const C = new Map();
  const shard = s => {
    if (!C.has(s)) {
      const d = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'seasons', `${s}.json`), 'utf8'));
      const byTeam = {};
      for (const p of d.players) { registerHiddenRatings(p); (byTeam[p.t] = byTeam[p.t] || []).push(p); }
      C.set(s, { players: d.players, byTeam });
    }
    return C.get(s);
  };
  const part = async coach => {
    let n = 0, de = 0;
    for (let i = 0; i < 60; i++) {
      const { cartes } = await tirerJoueursDuPack('j:hasard_argent', { graine: `depisteur-${i}`, n: i, mods: coach ? { coach } : {}, saisons: saisons.slice(20, 50), shard: async s => shard(s) });
      for (const x of cartes) { n++; if (coachDuJoueur(x.p) === 'rapaces') de++; }
    }
    return de / Math.max(1, n);
  };
  const sans = await part(null), avec = await part('rapaces');
  exiger('le dépisteur de l\'Aigle recrute plus de joueurs de sa couleur', avec > sans + 0.03, `${Math.round(sans * 100)} % sans coach → ${Math.round(avec * 100)} % avec l'Aigle`);
}

verdict('Les coachs');
