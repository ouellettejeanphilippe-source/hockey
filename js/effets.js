/*
 * LA GRAMMAIRE D'UN EFFET (V25 B1b, docs/refonte-v25.md § 4 B). Huit grammaires disaient la même chose : les canaux
 * d'un pouvoir (`effet`), le style d'un adjoint et la condition de son signal (V27 : fondus en pièces de banc), les champs d'une réponse d'histoire
 * (`gain`, `action`, `si`, le `bon` et le `prix` écrits à côté), ceux d'une carte de la banque. Il n'en reste qu'une,
 * neuf cases, et tout ce qu'une carte de jeu fait s'écrit là :
 *
 *   quand    la seule forme de déclenchement : une fonction de ce qui est déjà joué (une pièce de banc et son relais,
 *            js/pieces.js : `quand(e)`), ou le nom d'un moment (`MOMENTS_SI`, js/sim.js ; l'état d'une série)
 *   canaux   les canaux du moteur sur ton club — volume, finition, defense, discipline, robustesse (additive, c'est
 *            écrit dans le canal), blessure, energie, F, D
 *   adv      les mêmes canaux, posés sur l'adversaire
 *   lui      ce qui va au joueur nommé : lancers, finition, creation, defense, blessure, arrets
 *   duree    en matchs
 *   jetons   versés une fois, à la décision, jamais sous un `quand` (la caisse reste recomptée des décisions)
 *   gestes   les gestes d'aujourd'hui : soin (tousLesBlesses), absents, energie, energieTous, gardienAux, piece
 *            (une pièce pour ton banc, V27), echange et offres (le doublon qui part, les joueurs offerts)
 *   pari     { chance, gagne, perd } : deux effets de la même grammaire, tirés au dé
 *   suite    l'histoire qui suivra, en matchs
 *
 * LES CHIFFRES SE DÉRIVENT DE L'EFFET, LA RÉPLIQUE RESTE ÉCRITE (JP, 5 nov. 2026) : `motsDe(effet)` rend les lignes
 * vertes et rouges d'une carte, dans les mots que `check_mots` exige, à partir de ce que le moteur joue (js/impact.js
 * `motsEnChiffres`) ; elles ne peuvent plus mentir. La réplique de hockey (`dit`, « Ils hésitent à venir ») reste
 * écrite à la main par la voix, parce que c'est elle qui fait lire une carte comme du hockey.
 */
import { motsEnChiffres, flechesDe } from './impact.js';
import { facesDuPari } from './sim.js';
import { cap } from './util.js';

export const CASES = ['quand', 'canaux', 'adv', 'lui', 'duree', 'jetons', 'gestes', 'pari', 'suite'];
export const CANAUX = ['volume', 'finition', 'defense', 'discipline', 'robustesse', 'blessure', 'energie', 'F', 'D'];
export const CANAUX_LUI = ['lancers', 'finition', 'creation', 'defense', 'blessure', 'arrets'];
export const GESTES = ['soin', 'tousLesBlesses', 'absents', 'energie', 'energieTous', 'gardienAux', 'piece', 'echange', 'offres'];

/* Un canal posé à sa valeur neutre ne fait rien (la robustesse est additive). */
const neutre = (k, v) => v == null || (k === 'robustesse' ? v === 0 : Array.isArray(v) ? v.every(x => x === 1) : v === 1);
const vide = o => !o || Object.entries(o).every(([k, v]) => neutre(k, v));
/* Un effet qui ne fait rien : aucune case qui joue. */
export const estVide = e => !e || (vide(e.canaux) && vide(e.adv) && vide(e.lui) && !e.jetons && !e.pari && !e.suite
  && !(e.gestes && Object.values(e.gestes).some(Boolean)));

const plur = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const signe = n => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;

/* LES GESTES, EN MOTS : qui ils touchent (`qui`, le joueur nommé), et ce qui lui arrive. */
function motsDesGestes(g, qui = 'Le joueur visé', { offert = null } = {}) {
  const out = [];
  if (!g) return out;
  if (g.soin) out.push({ txt: `${g.tousLesBlesses ? 'Tous tes blessés' : qui} : −${plur(g.soin, 'match')} d'infirmerie`, bon: true });
  if (g.absents) out.push({ txt: `${qui} manque ${plur(g.absents, 'match')}`, bon: false });
  if (g.energie) out.push({ txt: `${qui} : jambes ${signe(g.energie)}`, bon: g.energie > 0 });
  if (g.energieTous) out.push({ txt: `Toute l'équipe : jambes ${signe(g.energieTous)}`, bon: g.energieTous > 0 });
  if (g.gardienAux) out.push({ txt: `L'auxiliaire au filet ${plur(g.gardienAux, 'match')}`, bon: null });
  if (g.piece) out.push(...(offert || [{ txt: 'Une pièce pour ton banc', bon: true }]));
  if (g.echange) out.push({ txt: `Ton doublon le plus fourni part : ${plur(g.offres || 1, 'joueur')} de son époque, un signé`, bon: true });
  return out;
}

/* ======================================================================
   CE QUI BOUGE CHEZ UN JOUEUR NOMMÉ (V11)
   ====================================================================== */
export const MOTS_DU_JOUEUR = { lancers: ['ses tirs', true], finition: ['sa précision', true], creation: ['ses passes', true], defense: ['leur précision contre lui', false], blessure: ['ses blessures', false], arrets: ['les buts qu\'il accorde', false] };
/* Sur la face, sans chiffre et court (une carte de la main a la largeur d'un pouce) : « Le visé : tire plus juste ». */
const FACE_DU_JOUEUR = { lancers: ['tire plus', 'tire moins'], finition: ['tire plus juste', 'tire moins juste'], creation: ['passe plus', 'passe moins'],
  defense: ['plus facile à battre', 'plus dur à battre'], blessure: ['se blesse plus', 'se blesse moins'], arrets: ['accorde plus', 'accorde moins'] };
/*
 * Ce qui bouge chez un joueur nommé, un canal par ligne : « Ton joueur : sa précision +80 % » aux règles, et
 * « Ton joueur : tire plus juste » sur la face (`mot`, lu par `enMotsEtChiffres`).
 */
export const motsSurLeJoueur = (canaux, qui, quand = '', court = qui) => Object.entries(canaux || {}).filter(([k]) => MOTS_DU_JOUEUR[k])
  .map(([k, v]) => ({ txt: `${qui} : ${MOTS_DU_JOUEUR[k][0]} ${flechesDe(v)}${quand ? `, ${quand}` : ''}`, bon: MOTS_DU_JOUEUR[k][1] ? v > 1 : v < 1,
    cle: 'surLui', mot: `${court} : ${FACE_DU_JOUEUR[k][v > 1 ? 0 : 1]}` }));

/* Les faces gagnantes d'un dé, les plus hautes : « sur 4, 5 ou 6 ». Jamais une cote. */
export const facesMot = k => { const f = Array.from({ length: k }, (_, i) => 7 - k + i); return `sur ${f.length > 1 ? `${f.slice(0, -1).join(', ')} ou ${f[f.length - 1]}` : `un ${f[0]}`}`; };
/*
 * UN PARI SE DIT D'UNE SEULE FAÇON (V19, tranche 6 ; JP : *une seule lecture des choix*) : le dé et sa chance, ce qu'il donne
 * s'il tombe, ce qu'il donne sinon — en vraies stats, une puce verte et une puce rouge. Ses deux issues sont des effets
 * de la même grammaire ; l'audace d'une histoire vise son joueur (`lui`) : ce qui lui arrive se dit à son nom.
 */
export function motsDuPari(pari, qui = 'Ton joueur') {
  const issue = e => { const m = motsDe(e, { qui }); return m.length ? m.map(x => x.txt).join(', ') : 'rien ne change'; };
  return [{ txt: `🎲 ${cap(facesMot(facesDuPari(pari.chance)))} : ${issue(pari.gagne)}`, bon: true }, { txt: `🎲 sinon : ${issue(pari.perd)}`, bon: false }];
}

/*
 * LES MOTS D'UN EFFET : ses lignes `{ txt, bon }`, dérivées de ce qu'il fait, dans l'ordre où une carte les lit — les
 * jetons, les canaux (en vraies stats du club courant, js/impact.js), les gestes, le joueur nommé, le dé.
 * `qui` : le joueur nommé (son nom court) ; `cadre` : { part, par, eux } pour les canaux (une période, un soir) ;
 * `offert` : les lignes de la pièce offerte, quand l'écran la connaît.
 */
export function motsDe(e, { qui = 'Ton joueur', cadre = null, offert = null } = {}) {
  if (!e) return [];
  const out = [];
  if (e.jetons) out.push({ txt: `${signe(e.jetons)} 🪙`, bon: e.jetons > 0 });
  if (!vide(e.canaux)) out.push(...motsEnChiffres(e.canaux, e.duree || null, cadre));
  if (!vide(e.adv)) out.push(...motsEnChiffres(e.adv, e.duree || null, { ...(cadre || {}), eux: true }));
  out.push(...motsDesGestes(e.gestes, qui, { offert }));
  if (!vide(e.lui)) out.push(...motsSurLeJoueur(e.lui, qui));
  if (e.pari) out.push(...motsDuPari(e.pari, qui));
  return out;
}
