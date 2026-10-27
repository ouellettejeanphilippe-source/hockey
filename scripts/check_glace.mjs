/*
 * LA GLACE OÙ LES TIRS APPARAISSENT (js/glace.js ; JP, 27 oct. 2026 : *créer une localisation pour chaque tir selon les
 * icônes du joueur et de ses coéquipiers* ; *les tirs avec position inspirée du texte qui décrit le but dans le
 * sommaire*). Le moteur ne calcule aucune coordonnée : la position est illustrative, tirée de la feuille. Ce qui se
 * vérifie, sur de vraies feuilles de match :
 *
 *   1. chaque tir tombe sur la glace, dans la moitié que son camp attaque (A à droite aux périodes 1 et 3) ;
 *   2. la même feuille pose les mêmes points (hache), et ils sont distincts d'un tir à l'autre ;
 *   3. LA CHANCE DU LANCER DIT LA DISTANCE : les tirs les plus dangereux sont plus près du filet que les moins dangereux ;
 *   4. LES ICÔNES DISENT L'ENDROIT : un sniper tire de plus large qu'un power forward, un défenseur de plus loin qu'un
 *      attaquant ; l'accord des rebonds (le trio) rapproche le tir du filet ;
 *   5. LE TEXTE DU SOMMAIRE DIT LA ZONE : un but dont `recitDeBut` nomme un lieu se pose dans cette zone-là ;
 *   6. chaque lancer de la feuille a son point, et les buts y sont ; chaque zone sert au moins une fois.
 *
 *   node scripts/check_glace.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua } from '../js/sim.js';
import { positionDuTir, zoneDuTexte, coteDuTexte, evenementsDeFeuille as evenements, glaceDuMatchHtml, ZONES, LONGUEUR, LARGEUR } from '../js/glace.js';
import { recitDeBut, GESTES } from '../js/recit.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
function ligue(seed, n = 12) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const sh = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    const p = un.flat().map(y => ({ ...y })); p.forEach(registerHiddenRatings);
    out.push(createTeam(`${tag} ${sh.season}`, tag, autoRoster(p), { season: sh.season }));
  }
  return out;
}

/* Des feuilles réelles : trois ligues, vingt journées chacune ; les matchs de ton club portent leur feuille. */
const feuilles = [];
for (const seed of [3, 5, 8]) {
  const teams = ligue(seed), you = teams[0];
  you.isPlayer = true;
  const L = creerLigue(teams, 82, { graine: `glace-${seed}`, courbe: true });
  jouerJusqua(L, 20);
  for (const jour of L.calendrier) for (const m of jour) if (m.joue && m.feuille && m.feuille.lancers && m.feuille.lancers.length) feuilles.push({ f: m.feuille, graine: `${seed}-${feuilles.length}` });
}
informer('feuilles lues', `${feuilles.length} matchs`);

const tous = [];
for (const { f, graine } of feuilles) for (const e of evenements(f)) tous.push({ e, f, pos: positionDuTir(e, f) });
exiger('des feuilles réelles, avec des tirs et des buts', feuilles.length >= 10 && tous.length > 400 && tous.some(x => x.e.type === 'but'), `${tous.length} tirs dans ${feuilles.length} matchs`);

/* 1. Sur la glace, dans la bonne moitié. */
{
  const per = e => (e.instant >= 60 ? 4 : Math.min(3, Math.floor(e.instant / 20) + 1));
  const hors = tous.filter(({ pos }) => !(pos.x > 0 && pos.x < LONGUEUR && pos.y > 0 && pos.y < LARGEUR));
  const mal = tous.filter(({ e, pos }) => { const droite = per(e) === 2 ? e.cote === 'B' : e.cote === 'A'; return droite ? pos.x <= 100 : pos.x >= 100; });
  exiger('chaque tir tombe sur la glace', hors.length === 0, `${hors.length} hors de la patinoire`);
  exiger('chaque camp tire dans la moitié qu\'il attaque (les camps changent de bout à la 2e)', mal.length === 0, `${mal.length} dans la mauvaise moitié`);
}

/* 2. Pur, et varié. */
{
  const bis = tous.slice(0, 300).filter(({ e, f, pos }) => JSON.stringify(positionDuTir(e, f)) !== JSON.stringify(pos));
  const uniques = new Set(tous.map(({ pos }) => `${pos.x}|${pos.y}`)).size;
  exiger('la même feuille pose les mêmes points', bis.length === 0, `${bis.length} différents sur 300`);
  exiger('deux tirs ne se superposent pas (presque jamais)', uniques > tous.length * 0.9, `${uniques} positions pour ${tous.length} tirs`);
}

/* 3. La chance du lancer dit la distance. */
const distanceFiletDe = pos => { const x = pos.x > 100 ? 189 - pos.x : pos.x - 11; return Math.hypot(x, pos.y - 42.5); };
{
  const arrets = tous.filter(x => x.e.type === 'arret' && x.e.p != null).sort((a, b) => a.e.p - b.e.p);
  const q = Math.floor(arrets.length / 4);
  const moy = l => l.reduce((s, x) => s + distanceFiletDe(x.pos), 0) / Math.max(1, l.length);
  const bas = moy(arrets.slice(0, q)), haut = moy(arrets.slice(-q));
  exiger('les tirs les plus dangereux se posent plus près du filet que les moins dangereux', haut < bas - 12, `${haut.toFixed(0)} pi contre ${bas.toFixed(0)} pi (le quart le plus dangereux contre le moins dangereux)`);
  const buts = tous.filter(x => x.e.type === 'but'), ar = tous.filter(x => x.e.type === 'arret');
  exiger('un but vient de plus près qu\'un arrêt', moy(buts) < moy(ar) - 4, `${moy(buts).toFixed(0)} pi contre ${moy(ar).toFixed(0)} pi`);
}

/* 4. Les icônes disent l'endroit. */
{
  const arrets = tous.filter(x => x.e.type === 'arret' && x.e.tireur && x.pos.role);
  const ecart = x => Math.abs(x.pos.y - 42.5);
  const dF = x => distanceFiletDe(x.pos);
  const moy = (l, f) => l.reduce((s, x) => s + f(x), 0) / Math.max(1, l.length);
  const roleDe = k => arrets.filter(x => x.pos.role.cle === k && !/^(D|LD|RD)$/.test(x.e.tireur.p));
  const sniper = roleDe('sniper'), power = roleDe('power');
  informer('rôles lus', `${sniper.length} snipers, ${power.length} power forwards`);
  exiger('un sniper tire de plus large qu\'un power forward (le cercle contre le devant du filet)', sniper.length >= 20 && power.length >= 20 && moy(sniper, ecart) > moy(power, ecart) + 2, `${moy(sniper, ecart).toFixed(1)} pi du centre contre ${moy(power, ecart).toFixed(1)} pi`);
  const def = arrets.filter(x => /^(D|LD|RD)$/.test(x.e.tireur.p)), att = arrets.filter(x => !/^(D|LD|RD)$/.test(x.e.tireur.p));
  exiger('un défenseur tire de plus loin qu\'un attaquant (la pointe)', def.length >= 20 && moy(def, dF) > moy(att, dF) + 6, `${moy(def, dF).toFixed(0)} pi contre ${moy(att, dF).toFixed(0)} pi`);
  // L'accord du trio : « les rebonds » (un sniper et un power forward ensemble) pose le tir plus près du filet.
  const avec = att.filter(x => x.e.acc === 'rebonds'), sans = att.filter(x => !x.e.acc);
  informer('accords vus', [...new Set(att.map(x => x.e.acc).filter(Boolean))].join(', ') || 'aucun');
  if (avec.length >= 25 && sans.length >= 25) exiger('l\'accord des rebonds rapproche le tir du filet', moy(avec, dF) < moy(sans, dF) - 1, `${moy(avec, dF).toFixed(1)} pi contre ${moy(sans, dF).toFixed(1)} pi sans accord (${avec.length} tirs)`);
  else informer('l\'accord des rebonds', `trop peu de tirs dans ces feuilles (${avec.length}) : jugé par le modèle seul`);
}

/* 5. Le texte du sommaire dit la zone. */
{
  const buts = tous.filter(x => x.e.type === 'but' && x.e.but.marqueur && x.e.but.instant < 60);
  let dits = 0, fidele = 0; const mal = [];
  for (const { e, pos } of buts) {
    const t = recitDeBut(e.but), z = zoneDuTexte(t);
    if (!z) continue;
    dits++;
    if (pos.zone === z && pos.duTexte && pos.texte === t) fidele++; else mal.push(`${z} ≠ ${pos.zone} : ${t.slice(0, 60)}`);
  }
  informer('buts dont le texte nomme un lieu', `${dits} sur ${buts.length}`);
  exiger('un but dont le sommaire nomme un lieu se pose dans cette zone', dits >= 10 && fidele === dits, mal.slice(0, 2).join(' · ') || `${fidele} sur ${dits}`);
  // Chaque phrase de GESTES qui nomme un lieu se classe : la liste des mots ne laisse pas passer un lieu connu.
  const exemples = [['décoche du cercle gauche', 'cercle'], ['tire de la pointe, la rondelle ricoche', 'pointe'], ['file seul en échappée', 'echappee'], ['se faufile jusque dans l\'enclave', 'enclave'], ['saute sur le retour', 'crease'], ['monte en vitesse sur l\'aile', 'aile'], ['décoche de la ligne bleue', 'ligneBleue']];
  const rates = exemples.filter(([t, z]) => zoneDuTexte(t) !== z).map(([t, z]) => `« ${t} » → ${zoneDuTexte(t)} (attendu ${z})`);
  exiger('les mots du sommaire se rangent dans la bonne zone', rates.length === 0, rates.join(' · ') || `${exemples.length} phrases`);
}

/* 6. Chaque lancer a son point ; chaque zone sert. */
{
  const manque = feuilles.filter(({ f }) => evenements(f).length !== f.lancers.filter(l => !l.but).length + f.buts.length);
  exiger('chaque lancer et chaque but de la feuille a son point', manque.length === 0, `${feuilles.length} feuilles, ${tous.length} points`);
  const zones = new Map(); for (const { pos } of tous) zones.set(pos.zone, (zones.get(pos.zone) || 0) + 1);
  const absentes = Object.keys(ZONES).filter(k => !zones.has(k));
  exiger('chaque zone de la patinoire sert au moins une fois', absentes.length === 0, absentes.join(' · ') || [...zones].map(([k, n]) => `${k} ${n}`).join(' · '));
}

/* 8. CE QUE LE SOMMAIRE DIT, LA GLACE LE MONTRE : chaque phrase de but a sa zone, et chaque but y est, du côté dit. */
{
  const sans = Object.entries(GESTES).flatMap(([style, ph]) => ph.filter(t => !zoneDuTexte(t)).map(t => `${style} : ${t}`));
  exiger('chaque phrase de but du sommaire dit une zone de la patinoire', sans.length === 0, sans.join(' · ') || `${Object.values(GESTES).flat().length} phrases`);
  const buts = tous.filter(x => x.e.type === 'but' && x.pos.texte && zoneDuTexte(x.pos.texte));
  const hors = buts.filter(x => x.pos.zone !== zoneDuTexte(x.pos.texte));
  exiger('le point de chaque but est dans la zone que son texte du sommaire dit', buts.length > 100 && hors.length === 0, `${buts.length} buts, ${hors.length} hors zone`);
  const cotes = buts.filter(x => coteDuTexte(x.pos.texte) !== 0);
  const mauvais = cotes.filter(x => {
    const per = x.e.instant >= 60 ? 4 : Math.min(3, Math.floor(x.e.instant / 20) + 1);
    const sens = per === 2 ? (x.e.cote === 'A' ? -1 : 1) : (x.e.cote === 'A' ? 1 : -1);
    return Math.sign((x.pos.y - 42.5) * sens) !== coteDuTexte(x.pos.texte);
  });
  informer('buts dont le texte nomme un côté', `${cotes.length}`);
  exiger('un but « du cercle gauche » est posé à gauche du tireur, vu de face au filet', mauvais.length === 0, `${mauvais.length} de travers sur ${cotes.length}`);
}

/* 7. Le sommaire dessine la même glace : un point par tir, les mêmes places. */
{
  const { f } = feuilles[0], html = glaceDuMatchHtml(f, { couleurs: { A: '#c8102e', B: '#003087' } });
  const pts = (html.match(/<circle class="gl-pt/g) || []).length;
  exiger('le sommaire dessine un point par tir', pts === evenements(f).length && /gl-svg/.test(html), `${pts} points`);
  exiger('une feuille d\'avant, sans lancers, n\'a pas de glace', glaceDuMatchHtml({ buts: [], tirs: { A: [], B: [] } }, { couleurs: { A: '#000', B: '#fff' } }) === '');
}

verdict('La glace où les tirs apparaissent');
