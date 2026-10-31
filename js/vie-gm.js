/*
 * LES VOIX DU JEU, ET LES FILS DE LA SAISON (V22, docs/refonte-v22.md). Le fichier portait la banque d'événements de la
 * vie d'un DG-coach (courriels, dilemmes, points de presse) : elle est partie, sans être reprise (JP : *les événements,
 * c'est encore à chier : supprime la banque, pas le système*). Il reste :
 *
 *   EXPEDITEURS     qui écrit dans la boîte : une seule distribution de voix
 *   joueurDuFait    le joueur qu'un fait vise, lu dans les feuilles déjà jouées
 *   VOIX_DES_FILS   les fils de la saison, dits par quelqu'un (la une, la boîte)
 *   CHOIX_DES_FILS  le choix qu'un fil fort ouvre (vide : la banque neuve s'écrit à la V22, phase 4)
 *
 * Tout est PUR : le même contexte et la même graine redonnent le même tirage, sans `hasard()`.
 */

import { nomCourt, deNom } from './recit.js';

/** Hachage stable d'une chaîne (le même que js/recit.js), pour tirer sans hasard vivant. */
function graine(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}


/**
 * QUI ÉCRIT : l'icône et le nom que la boîte affiche (`m.de`). Une seule distribution pour toute la boîte
 * (V3, JP : *les messages sont des trucs du proprio, coach, joueurs, partisans, analystes*) : les courriels,
 * les choix forcés (js/saison.js) et les fils de la saison (`messageDuFil`) parlent par ces voix-là.
 */
export const EXPEDITEURS = {
  pr: { ico: '🏢', nom: 'Le proprio' },
  en: { ico: '🧑‍🏫', nom: 'L\'entraîneur' },
  an: { ico: '📺', nom: 'L\'analyste à la télé' },
  pt: { ico: '📣', nom: 'Les partisans' },
  ca: { ico: '🎖', nom: 'Le capitaine' },
  fi: { ico: '🧾', nom: 'Le directeur des finances' },
  ad: { ico: '🎯', nom: 'Ton adjoint' },
  ag: { ico: '🤝', nom: 'Un agent de joueur' },
  ph: { ico: '🩺', nom: 'Le physio' },
  eq: { ico: '🧦', nom: 'Le préposé à l\'équipement' },
  co: { ico: '📢', nom: 'Le service des communications' },
  li: { ico: '🪪', nom: 'La ligue' },
  pa: { ico: '🧣', nom: 'Un partisan fidèle' },
  ma: { ico: '🗳', nom: 'Le maire' },
  // Les voix d'À faire (Jalon M) : elles vivaient à part dans js/saison.js (`DE`) ; une seule distribution.
  me: { ico: '🩺', nom: 'Le médecin' },
  dg: { ico: '📋', nom: 'Le DG' },
  dp: { ico: '🔎', nom: 'Le dépisteur' },
};

/*
 * LE JOUEUR DU FAIT (V11, tranche 5 — docs/refonte-v11.md). JP : *l'interview vise un joueur quand le fait vient de
 * lui*. La question vise celui dont le fait vient, lu dans les feuilles qu'elle raconte (`feuilles` : [{ f, cote }],
 * dans l'ordre) : le gardien qui a reçu les tirs du dernier soir, le meilleur pointeur, celui qui a pris le plus de
 * punitions — parmi `habilles` (un Set). Personne dans les feuilles : null, et la question garde sa cible d'avant
 * (`ciblesDe`, js/sim.js). Rend { p, fait }, le fait en vrais chiffres. Pur.
 */
export function joueurDuFait(sorte, feuilles, habilles) {
  const compter = (liste, f) => { const n = new Map(); for (const x of liste) { const p = f(x); if (p && habilles.has(p)) n.set(p, (n.get(p) || 0) + 1); } return [...n].sort((a, b) => b[1] - a[1])[0] || null; };
  if (sorte === 'gardien') {
    const der = feuilles[feuilles.length - 1];
    const g = der && compter((der.f.lancers || []).filter(l => l.cote !== der.cote), l => l.gardien);
    if (!g) return null;
    const buts = (der.f.buts || []).filter(b => b.cote !== der.cote && b.gardien === g[0]).length;
    return { p: g[0], fait: `${g[0].n} : ${buts} but${buts > 1 ? 's' : ''} sur ${g[1]} tirs ce soir-là` };
  }
  if (sorte === 'vedette') {
    const v = compter(feuilles.flatMap(({ f, cote }) => (f.buts || []).filter(b => b.cote === cote).flatMap(b => [b.marqueur, ...(b.passeurs || [])])), p => (p && p.p !== 'G' ? p : null));
    return v ? { p: v[0], fait: `${v[0].n} : ${v[1]} point${v[1] > 1 ? 's' : ''} en ${feuilles.length} matchs` } : null;
  }
  if (sorte === 'dur') {
    const d = compter(feuilles.flatMap(({ f, cote }) => (f.punitions || []).filter(x => x.cote === cote)), x => x.joueur);
    return d ? { p: d[0], fait: `${d[0].n} : ${d[1]} punition${d[1] > 1 ? 's' : ''} en ${feuilles.length} matchs` } : null;
  }
  return null;
}

/*
 * LES FILS DE LA SAISON, DITS PAR QUELQU'UN (V3.3). Le fil qui a fait la une hier soir (`filsDeSaison`,
 * js/recit.js) arrive dans la boîte d'une voix qui a une raison d'en parler : la course et le duo, l'analyste ;
 * le Cheechoo et la séquence, les partisans ; le jalon, le proprio ; la disette, l'entraîneur, puis le joueur
 * lui-même quand elle finit ; la recrue, le capitaine ; le retour, le physio. Le FAIT est celui du fil, au
 * caractère près (check_fils le recompte) ; la voix ajoute une opinion, jamais un chiffre.
 */
const VOIX_DES_FILS = {
  course: { de: 'an', mots: ['À ce rythme-là, on va parler de {nom} jusqu\'au printemps.', 'Les gardiens de la ligue commencent à voir {nom} dans leur soupe.', 'Je l\'ai dit en ondes et je le répète : surveillez {nom}.', '{nom} joue avec l\'aplomb d\'un gars qui sait où est le filet.'] },
  feu: { de: 'pt', mots: ['On scande son nom dans les gradins. Personne n\'avait vu ça venir.', 'Les gradins se lèvent dès qu\'il saute sur la glace.', 'Un joueur de soutien qui fait lever la foule : on ne s\'en lasse pas.'] },
  jalon: { de: 'pr', mots: ['Mes félicitations à {nom}. Ce genre de soirée fait vendre des billets.', 'Transmettez mes félicitations au vestiaire, et à {nom} en premier.', 'On se souviendra de cette soirée. Je fais encadrer la feuille de match.'] },
  sequence: { de: 'pt', mots: ['Les gradins attendent {nom} à chaque présence.', 'Chaque soir, on se demande si ce sera le bon. Et chaque soir, il répond.'], fin: { de: 'an', mots: ['Toutes les séquences finissent un jour. Ce qui compte, c\'est la suivante.', 'Belle séquence. Reste à voir s\'il repart tout de suite.'] } },
  disette: { de: 'en', mots: ['Je le garde où il est. Les rondelles vont finir par rentrer.', 'Il travaille. Je ne change rien pour l\'instant, mais je regarde.', 'Ce n\'est pas la volonté qui manque. C\'est la rondelle qui ne veut pas.'], fin: { de: 'joueur', mots: ['Enfin. Je dormais mal.', 'Ça fait du bien. Merci aux gars de m\'avoir attendu.', 'Je ne comptais plus. Les journalistes, eux, comptaient.'] } },
  duo: { de: 'an', mots: ['Ces deux-là se trouvent les yeux fermés.', '{passeur} lui dépose la rondelle sur la palette ; il n\'a qu\'à finir.', 'Séparer {nom} et {passeur} ? Je ne m\'y risquerais pas.'] },
  recrue: { de: 'ca', mots: ['Le petit n\'a peur de rien. On l\'aime bien dans le vestiaire.', 'Il pose des questions et il écoute les réponses. Ça paraît.', 'Il joue comme s\'il avait dix ans dans la ligue.'] },
  retour: { de: 'ph', mots: ['Le corps a tenu. On le surveille encore quelques jours.', 'Il a fait tout ce qu\'on lui demandait pendant son absence. Ça paie.'] },
};

/*
 * LES FILS QUI REVIENNENT (V9, tranche 6 — docs/refonte-v9.md § 6.7). En Rogue, un fil fort ouvre un choix dans
 * À faire, dit par sa voix (`VOIX_DES_FILS`) : le Cheechoo, la disette, le duo, la recrue. Chaque option passe par les
 * canaux qui existent (une `action` sur le joueur nommé, un déplacement de cases, `monte`) et, souvent, engage un
 * SUIVI : `apres` matchs plus tard, le moteur relit les feuilles (`mesure` : ses buts, ses points, les buts du duo) et
 * pose ce que le seuil décide — `gagne` ou `perd`, des effets de quelques matchs sur le joueur nommé (`sur`), jamais
 * un dé (js/sim.js `retoursDuMatin`). Le retour se lit à la une, avec ses vrais chiffres (`texteDuRetour`).
 * Les mots : `{nom}` le joueur du fil, `{deplace}` celui qu'il déloge, `{passeur}` son passeur, `{vieux}` le vétéran mentor.
 */
/* LE CHOIX D'UN FIL — vide (V22). Forme d'une entrée : { ico, titre, question, options: [{ cle, nom, bon, prix, …, suivi?: { apres, mesure, seuil, depuis, gagne?, perd? } }] }. */
export const CHOIX_DES_FILS = {};
const UNITES_DU_SUIVI = { buts: 'but', points: 'point', duo: 'but' };
export const avecNoms = (t, x) => String(t || '').replace(/\{nom\}/g, x.nom || '').replace(/\{deplace\}/g, x.deplace || 'son remplaçant').replace(/\{passeur\}/g, x.passeur || 'son passeur').replace(/\{vieux\}/g, x.vieux || 'un vétéran');
/** L'engagement d'une option, en mots : « Dans 10 matchs, 4 buts : il garde le feu ; sinon, X demande à jouer. » */
export function motDuSuivi(s, x = {}) {
  if (!s) return '';
  const u = UNITES_DU_SUIVI[s.mesure], quoi = `${s.seuil} ${u}${s.seuil > 1 ? 's' : ''}${s.mesure === 'duo' ? ' sur ses passes' : ''}`;
  return avecNoms(`Dans ${s.apres} matchs, ${quoi} : ${s.gagne ? s.gagne.mot : 'rien de plus'}${s.perd ? ` ; sinon, ${s.perd.mot}` : ''}`, x);
}
/** Le retour, dit avec ses vrais chiffres, lus dans les feuilles : « Kudelski : 5 buts en 10 matchs depuis qu'il est monté. Il garde le feu. » */
export function texteDuRetour(s, gagne, n, x = {}) {
  const u = UNITES_DU_SUIVI[s.mesure], b = gagne ? s.gagne : s.perd;
  const quoi = `${n} ${u}${n > 1 ? 's' : ''}${s.mesure === 'duo' ? ` sur des passes ${x.passeur ? deNom(x.passeur) : 'de son passeur'}` : ''}`;
  const mot = b ? avecNoms(b.mot, x) : '';
  return `${x.nom} : ${quoi} en ${s.apres} matchs depuis ${s.depuis}.${mot ? ` ${mot[0].toUpperCase()}${mot.slice(1)}.` : ''}`;
}
/** Un suivi en cours, en une ligne de vrais chiffres : « 🐣 La recrue · Demitra : 3 / 6 points · 4/10 matchs ». */
export function motDuSuiviEnCours(x) {
  const u = UNITES_DU_SUIVI[x.suivi.mesure];
  return `${x.ico} ${x.titre} · ${nomCourt(x.joueur.n)} : ${x.n} / ${x.suivi.seuil} ${u}${x.suivi.seuil > 1 ? 's' : ''} · ${x.joues}/${x.suivi.apres} matchs`;
}
/** La voix qui raconte le retour d'un fil : celle du fil. */
export const voixDuFil = sorte => (VOIX_DES_FILS[sorte] || {}).de || 'an';

/** Le message d'un fil : { de, sujet, mot } — `sujet` est le fait du fil, `mot` ce qu'en dit sa voix. */
export function messageDuFil(a) {
  const v0 = VOIX_DES_FILS[a.sorte];
  const v = a.fini && v0.fin ? v0.fin : v0;
  const de = v.de === 'joueur' ? { ico: '🏒', nom: a.joueur.n } : EXPEDITEURS[v.de];
  const mot = v.mots[Math.floor(graine(`${a.texte}|${a.jour}`) * v.mots.length) % v.mots.length]
    .replace(/\{nom\}/g, nomCourt(a.joueur.n)).replace(/\{passeur\}/g, a.passeur ? nomCourt(a.passeur.n) : '');
  return { de, sujet: a.texte, mot };
}
