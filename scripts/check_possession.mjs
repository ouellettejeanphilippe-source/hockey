/*
 * SUR GLACE — LE PING-PONG ET LA DÉFENSIVE SE MESURENT (7 nov. 2026). JP, après un essai : *jeu sur glace moins ping
 * pong, plus réfléchi, pis surtout, meilleure défensive*. Des matchs de l'IA contre l'IA (js/glace-ia.js, le même bâton
 * que la manette), 3 × 2 min, deux clubs inventés égaux (ceux de check_physique), et ce qu'on y lit :
 *
 *   la possession     sa durée (en secondes et en passes réussies), le temps passé en zone offensive, comment elle finit
 *                     (un tir, une passe perdue, un harpon, une mise en échec, un dégagement, un arrêt de jeu) ;
 *   les revirements   la rondelle qui change de camp sans arrêt de jeu, par minute de jeu (un tir arrêté et repris par
 *                     le gardien, ou un retour qu'il rend, n'est pas un revirement : on le compte à part) ;
 *   les dégagements   au hasard : de sa zone, un lancer ou une passe sans receveur que l'adversaire reprend le premier ;
 *   les surnombres    à l'entrée de la zone, la rondelle portée : les attaquants dans le jeu contre les défenseurs
 *                     entre elle et leur filet (2 contre 1, 3 contre 2…) ; l'échappée : le porteur passé le centre,
 *                     personne entre lui et le gardien, le plus près à 3 m ou plus dans son dos ;
 *   les tirs          de l'enclave (à moins de 9 m du filet, à 4,5 m de l'axe au plus) contre ceux de loin (plus de 15 m) ;
 *   les cinq sans elle  quand l'adversaire a la rondelle dans notre zone : devant le filet, dans l'enclave, dans les
 *                     couloirs, hors de la zone ; et l'attaquant laissé seul dans l'enclave (personne à 2 m de lui).
 *
 * LES REPÈRES DE LA LNH (de mémoire, à l'ordre de grandeur ; aucun n'a été relu en ligne ici) : une possession dure de
 * l'ordre de 5 à 10 s et compte 1 à 2 passes réussies (les données de suivi, Sportlogiq et NHL Edge, citées dans la
 * presse) ; ≈ 2 % des possessions finissent en échappée (≈ 1 échappée par club et par match de 60 min, NHL Edge) ; 3 à
 * 5 montées à surnombre par club et par match (Sportlogiq) ; ≈ 40 à 50 % des tirs au but de l'enclave, ≈ 20 % de la
 * pointe (MoneyPuck, Natural Stat Trick). Le jeu est un arcade (≈ 3,5 buts par match de 6 min au lieu de 0,6) : on
 * compare des parts et des rythmes par possession, pas des comptes par match.
 *
 *   node scripts/check_possession.mjs      (GLACE_MATCHS, 10 par défaut ; GRAINE, le préfixe des graines)
 */
import { exiger, borne, informer, verdict } from './verdict.mjs';
import { nouveauMatch, avancer, surGlace, parametresDuPatineur, parametresDuGardien, LIGNE_BUT, BLEUE } from '../js/physique.js';
import { decisionIA } from '../js/glace-ia.js';

const DT = 1 / 60;
const N = +(process.env.GLACE_MATCHS || 10);
const GRAINE = process.env.GRAINE || 'possession';
const hyp = Math.hypot;
const club = (tag, k0) => ({ nom: tag, tag, patineurs: [
  ...[0, 1, 2].flatMap(l => ['AG', 'C', 'AD'].map((poste, i) => ({ id: k0 + l * 3 + i, nom: `${tag} ${poste}${l}`, poste, ligne: l, p: parametresDuPatineur({ cote: 8 + ((l * 3 + i) % 7), tir: 9 + (i * 3) % 8, jeu: 8 + (l * 5) % 9 }) }))),
  ...[0, 1].flatMap(l => [0, 1].map(i => ({ id: k0 + 20 + l * 2 + i, nom: `${tag} D${l}${i}`, poste: 'D', ligne: l, p: parametresDuPatineur({ cote: 9, robustesse: 14, poidsLb: 210 }) }))),
], gardien: { nom: `${tag} G`, p: parametresDuGardien({ arrets: 12 }) } });

const S = {
  jeu: 0, poss: [], fins: {}, revir: 0, revirTir: 0, hasard: 0, icing: 0, entrees: 0, surnombre: {}, echappees: 0,
  tirs: 0, enclave: 0, loin: 0, buts: 0, punitions: 0, bottes: 0, harpons: 0, leves: 0, echecs: 0,
  place: { devant: 0, enclave: 0, couloir: 0, dehors: 0 }, defT: 0, seulEnclave: 0, sansDevant: 0,
  passes: 0, passesOk: 0, presse: 0, nee: {}, dehorsD: 0, dehorsF: 0, posee: 0, poseeDehors: 0,
};
for (let g = 0; g < N; g++) {
  const e = nouveauMatch({ graine: `${GRAINE}-${g}`, A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: null, ia: decisionIA });
  const par = id => e.patineurs.find(p => p.id === id);
  let P = null;          // la possession en cours : { eq, t, passes, oz, echappee }
  let dernier = null;    // le dernier geste de l'équipe qui l'a : { type, x, eq, fond, vers }
  let avantU = null;     // la rondelle, la profondeur du pas d'avant (l'entrée dans la zone)
  const finir = (raison, versEq = null) => {
    if (!P) return;
    P.duree = e.t - P.t; P.fin = raison;
    S.poss.push(P); S.fins[raison] = (S.fins[raison] || 0) + 1;
    if (versEq) {
      if (raison === 'tir') S.revirTir++; else S.revir++;
      // au hasard : de sa zone, un lancer, ou une passe sans receveur, repris d'abord par l'adversaire
      if (dernier && dernier.zoneDef && (dernier.type === 'tir' || (dernier.type === 'passe' && !dernier.vers))) S.hasard++;
    }
    P = null;
  };
  let k = 0;
  while (!e.match.fini && k < 120 * 60 * 20) {
    k++;
    const ev = avancer(e, {}, DT);
    for (const v of ev) {
      if (v.type === 'but') S.buts++;
      if (v.type === 'punition') S.punitions++;
      if (v.type === 'botte') S.bottes++;
      if (v.type === 'harpon' && !v.gardien) S.harpons++;
      if (v.type === 'leve' && v.ok) S.leves++;
      if (v.type === 'echec') S.echecs++;
      if (v.type === 'degagement') S.icing++;
      if (v.type === 'tir' || v.type === 'passe') {
        const s = par(v.qui); if (!s) continue;
        const a = e.equipes[s.equipe].attaque;
        dernier = { type: v.type, eq: s.equipe, vers: v.vers, zoneDef: s.x * a < -BLEUE, fond: v.fond };
        if (v.type === 'passe') {
          S.passes++;
          if (surGlace(e, s.equipe === 'A' ? 'B' : 'A').some(o => hyp(o.x - s.x, o.y - s.y) < 3)) S.presse++;
        }
        if (v.type === 'tir' && !v.fond) {
          S.tirs++;
          const d = hyp(a * LIGNE_BUT - s.x, s.y);
          if (d < 9 && Math.abs(s.y) < 4.5) S.enclave++; else if (d > 15) S.loin++;
        }
      }
      if (v.type === 'prise') {
        const s = par(v.qui); if (!s) continue;
        if (P && P.eq !== s.equipe) finir(dernier && dernier.eq === P.eq ? (dernier.type === 'tir' ? (dernier.fond ? 'fond' : 'tir') : 'passe') : dernier && dernier.type === 'vol' ? `vol (${dernier.geste})` : 'perdue', s.equipe);
        if (P && P.eq === s.equipe && v.passe) P.passes++;
        if (dernier && dernier.type === 'passe' && dernier.eq === s.equipe) S.passesOk++;
        const avant = S.poss.length && !P ? S.poss[S.poss.length - 1] : null;
        if (!P) P = { eq: s.equipe, t: e.t, passes: 0, oz: 0, echappee: false, nee: avant && e.t - avant.t - avant.duree < 0.5 ? avant.fin : 'arret' };
        dernier = null;
      }
      if (['harpon', 'leve', 'echec'].includes(v.type) && P && dernier === null) {
        const s = par(v.qui);
        if (s && s.equipe !== P.eq) dernier = { type: 'vol', eq: s.equipe, geste: v.type === 'echec' ? 'charge' : v.type === 'leve' ? 'bâton soulevé' : 'harpon' };
      }
      if (['but', 'gel', 'horsjeu', 'degagement', 'vitre', 'punition', 'periode', 'fin', 'butRefuse'].includes(v.type)) finir(v.type === 'but' ? 'but' : 'arret');
    }
    if (!e.enJeu || e.mej || e.arret || e.match.ronde) { avantU = null; if (P && (e.arret || e.mej)) finir('arret'); continue; }
    S.jeu += DT;
    const R = e.rondelle, porteur = R.porteur ? par(R.porteur) : null;
    if (P) {
      const a = e.equipes[P.eq].attaque, u = R.x * a;
      if (u > BLEUE) P.oz += DT;
      // l'entrée dans la zone, la rondelle portée : les surnombres
      if (porteur && porteur.equipe === P.eq && avantU !== null && avantU <= BLEUE && u > BLEUE) {
        S.entrees++;
        const att = surGlace(e, P.eq).filter(m => m.x * a > u - 4).length;
        const def = surGlace(e, P.eq === 'A' ? 'B' : 'A').filter(o => o.x * a > u - 1).length;
        if (att > def && att >= 2) { const cle = `${att} contre ${def}`; S.surnombre[cle] = (S.surnombre[cle] || 0) + 1; }
      }
      // l'échappée : passé le centre, personne entre lui et le gardien, le plus près à 3 m dans son dos
      if (porteur && porteur.equipe === P.eq && !P.echappee && porteur.x * a > 0 && porteur.x * a < LIGNE_BUT - 3) {
        const adv = surGlace(e, P.eq === 'A' ? 'B' : 'A');
        const devant = adv.some(o => o.x * a > porteur.x * a - 0.5);
        const pres = Math.min(Infinity, ...adv.map(o => hyp(o.x - porteur.x, o.y - porteur.y)));
        if (!devant && pres > 3) { P.echappee = true; S.echappees++; S.nee[P.nee] = (S.nee[P.nee] || 0) + 1; }
      }
      avantU = u;
    }
    // les cinq sans la rondelle, l'adversaire la porte dans notre zone
    if (porteur) {
      const att = porteur.equipe, defEq = att === 'A' ? 'B' : 'A', a = e.equipes[att].attaque;
      if (R.x * a > BLEUE) {
        S.defT += DT;
        const net = { x: a * LIGNE_BUT, y: 0 };
        const D = surGlace(e, defEq);
        let devantN = 0;
        for (const m of D) {
          const d = hyp(m.x - net.x, m.y), dedans = m.x * a > BLEUE;
          const k2 = !dedans ? 'dehors' : d < 6 && Math.abs(m.y) < 3.5 ? 'devant' : Math.abs(m.y) < 6 && d < 15 ? 'enclave' : 'couloir';
          S.place[k2] += DT / D.length;
          if (k2 === 'dehors') { if (m.poste === 'D') S.dehorsD += DT; else S.dehorsF += DT; }
          if (k2 === 'devant') devantN++;
        }
        if (!devantN) S.sansDevant += DT;
        // la défense posée : la possession adverse dure depuis 2 s au moins
        if (P && P.eq === att && e.t - P.t > 2) { S.posee += DT; S.poseeDehors += D.filter(m => m.x * a <= BLEUE).length * DT / D.length; }
        const seul = surGlace(e, att).some(o => o !== porteur && hyp(o.x - net.x, o.y) < 9 && Math.abs(o.y) < 4.5 && !D.some(m => hyp(m.x - o.x, m.y - o.y) < 2));
        if (seul) S.seulEnclave += DT;
      }
    }
  }
  finir('fin');
}

const pc = x => `${(100 * x).toFixed(0)} %`;
const med = xs => { const t = xs.slice().sort((p, q) => p - q); return t.length ? t[Math.floor(t.length / 2)] : 0; };
const vraies = S.poss.filter(p => p.duree > 0.05);
const duree = vraies.reduce((t, p) => t + p.duree, 0) / Math.max(1, vraies.length);
const passes = vraies.reduce((t, p) => t + p.passes, 0) / Math.max(1, vraies.length);
const oz = vraies.reduce((t, p) => t + p.oz, 0) / Math.max(1, vraies.length);
const minutes = S.jeu / 60;
const surn = Object.values(S.surnombre).reduce((t, x) => t + x, 0);
const fins = Object.entries(S.fins).sort((p, q) => q[1] - p[1]).map(([k, x]) => `${k} ${pc(x / Math.max(1, S.poss.length))}`).join(', ');
const pl = S.place, plT = pl.devant + pl.enclave + pl.couloir + pl.dehors || 1;

informer(`${N} matchs de l'IA contre l'IA (3 × 2 min, graines ${GRAINE}-0 à ${N - 1})`, `${(S.buts / N).toFixed(2)} buts, ${(S.punitions / N).toFixed(2)} punitions, ${(S.bottes / N).toFixed(1)} poussées du patin par match ; ${minutes.toFixed(1)} min de jeu`);
informer('la possession : durée moyenne, médiane, passes réussies (LNH : 5 à 10 s, 1 à 2 passes)', `${duree.toFixed(2)} s, ${med(vraies.map(p => p.duree)).toFixed(2)} s, ${passes.toFixed(2)} passes ; ${(vraies.length / N).toFixed(0)} par match`);
informer('… en zone offensive, par possession', `${oz.toFixed(2)} s`);
informer('… comment elle finit', fins);
informer('les revirements, par minute de jeu (sans les tirs repris)', `${(S.revir / minutes).toFixed(1)} ; après un tir, ${(S.revirTir / minutes).toFixed(1)}`);
informer('… les gestes qui les font, par match', `${(S.harpons / N).toFixed(1)} harpons, ${(S.leves / N).toFixed(1)} bâtons soulevés, ${(S.echecs / N).toFixed(1)} mises en échec`);
informer('les passes réussies ; lancées sous pression (un adversaire à 3 m)', `${pc(S.passesOk / Math.max(1, S.passes))} ; ${pc(S.presse / Math.max(1, S.passes))}`);
informer('… les échappées nées de', Object.entries(S.nee).sort((p, q) => q[1] - p[1]).map(([k, x]) => `${k} ${x}`).join(', '));
informer('… hors de la zone : les défenseurs, les avants (patineur-secondes par match) ; posée depuis 2 s, la part dehors', `${(S.dehorsD / N).toFixed(1)}, ${(S.dehorsF / N).toFixed(1)} ; ${pc(S.poseeDehors / Math.max(1e-9, S.posee))} sur ${(S.posee / N).toFixed(1)} s par match`);
informer('les dégagements au hasard (de sa zone, repris d\'abord par l\'adversaire), par match', `${(S.hasard / N).toFixed(1)} ; dégagements refusés ${(S.icing / N).toFixed(1)}`);
informer('les entrées de zone rondelle portée, par match ; à surnombre (LNH : 3 à 5 par club et par 60 min)', `${(S.entrees / N).toFixed(1)} ; ${(surn / N).toFixed(1)} (${pc(surn / Math.max(1, S.entrees))}) — ${Object.entries(S.surnombre).sort((p, q) => q[1] - p[1]).map(([k, x]) => `${k} ${(x / N).toFixed(1)}`).join(', ')}`);
informer('les échappées accordées, par match ; par possession (LNH : ≈ 2 %)', `${(S.echappees / N).toFixed(1)} ; ${pc(S.echappees / Math.max(1, vraies.length))}`);
informer('les tirs : de l\'enclave, de loin (LNH : 40 à 50 %, ≈ 20 %)', `${(S.tirs / N).toFixed(0)} tentés par match ; ${pc(S.enclave / Math.max(1, S.tirs))}, ${pc(S.loin / Math.max(1, S.tirs))}`);
informer('les cinq sans la rondelle, l\'adversaire la porte dans notre zone', `devant le filet ${pc(pl.devant / plT)}, enclave ${pc(pl.enclave / plT)}, couloirs ${pc(pl.couloir / plT)}, hors de la zone ${pc(pl.dehors / plT)}`);
informer('… personne devant le filet ; un attaquant seul dans l\'enclave (% du temps)', `${pc(S.sansDevant / Math.max(1e-9, S.defT))} ; ${pc(S.seulEnclave / Math.max(1e-9, S.defT))}`);

exiger('chaque match va au bout et compte des possessions', vraies.length > 20 * N, `${vraies.length} possessions`);
verdict('Sur glace — le ping-pong et la défensive');
