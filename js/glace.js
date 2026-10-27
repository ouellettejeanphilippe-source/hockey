/*
 * LA GLACE OÙ LES TIRS APPARAISSENT (JP, 27 oct. 2026 : *j'aime bien de voir les tirs sur la glace apparaître* ;
 * *créer une localisation pour chaque tir selon les icônes du joueur et de ses coéquipiers* ; *les tirs avec position
 * inspirée du texte qui décrit le but dans le sommaire*). La vue de la patinoire de GM Connected, à notre façon.
 *
 * Le moteur ne calcule AUCUNE coordonnée : il joue des événements (MOTEUR.md, « l'événement est le lancer »). La
 * position d'un tir est donc ILLUSTRATIVE, tirée de ce que la feuille sait vraiment :
 *   - la chance du lancer (`p`) dit la distance : un tir dangereux se pose près du filet, un tir ordinaire loin ;
 *   - le rôle du tireur (ses badges : 🎯 sniper, 💪 power forward, 🅰 passeur, 🛑 défensif…) dit l'endroit d'où il
 *     tire — le sniper au cercle, le power forward devant le filet, le défenseur à la pointe ;
 *   - l'accord de son trio (`acc`, `AFFINITES` : ses coéquipiers) pousse la zone — « la passe et le tir » vers la
 *     fente, « les rebonds » devant le filet, « la sortie rapide » en échappée ;
 *   - un BUT se pose là où le texte du sommaire le dit (`recitDeBut`, js/recit.js : « décoche du cercle gauche »,
 *     « dans l'enclave », « file en échappée »), du côté qu'il dit : si le sommaire décrit un but, la glace le montre ;
 * Le nombre de points, leur camp, leur ordre, le tireur et le danger sont ceux de la feuille ; l'emplacement exact ne
 * l'est pas, et l'écran ne le prétend pas. Pur : la même feuille pose les mêmes points (`hache`). Aucune cote.
 */
import { badgesDe, AFFINITES } from './sim.js';
import { recitDeBut } from './recit.js';
import { hache } from './util.js';

/* La patinoire, en pieds : 200 de long, 85 de large ; la ligne de but à 11 pieds de la bande, la bleue à 75 et 125. */
export const LONGUEUR = 200, LARGEUR = 85;
const BUT_X = 189, MILIEU = 42.5;

/*
 * Les zones d'une moitié d'attaque, en (u, v) : `u` les pieds devant la ligne de but, `v` l'écart au centre
 * (le côté se tire). `pres` : une zone de danger, près du filet. Le cercle des mises en jeu est à 20 pieds de la
 * ligne de but et à 22 du centre ; la bleue, à 64 pieds.
 */
export const ZONES = {
  crease: { nom: 'devant le filet', u: [3, 9], v: [0, 7], pres: true },
  angle: { nom: 'd\'un angle fermé', u: [4, 12], v: [12, 22], pres: true },
  enclave: { nom: 'dans l\'enclave', u: [10, 24], v: [0, 12], pres: true },
  echappee: { nom: 'en échappée', u: [14, 40], v: [0, 8], pres: true },
  cercle: { nom: 'du cercle', u: [16, 32], v: [16, 30], pres: false },
  aile: { nom: 'de l\'aile', u: [30, 50], v: [26, 38], pres: false },
  pointe: { nom: 'de la pointe', u: [52, 68], v: [0, 16], pres: false },
  ligneBleue: { nom: 'de la ligne bleue', u: [50, 66], v: [16, 34], pres: false },
};
const CLES = Object.keys(ZONES);

/*
 * LE TEXTE DIT LA ZONE. Les mots du sommaire (`GESTES`, js/recit.js) et du commentateur (js/commentaire.js) nomment
 * l'endroit ; le premier motif qui colle gagne, du plus précis au plus général. Un texte sans lieu (« bat Dryden d'un
 * tir des poignets ») ne dit rien : la zone vient alors du modèle.
 */
const MOTS = [
  ['echappee', /échappée|file seul|défensive de vitesse|passe la défense|en solo devant|pleine course|rondelle libre|zone neutre|remonte (toute|la rondelle)|entre les deux défenseurs/i],
  ['pointe', /pointe|boulet|canonne|lancer frappé|tir sec de loin/i],
  ['ligneBleue', /ligne bleue|entrée de zone/i],
  ['cercle', /cercle/i],
  ['aile', /sur l'aile|à l'aile|sur la bande|la bande|par l'extérieur/i],
  ['angle', /angle fermé|petit côté|contourne le filet|derrière le filet|deuxième poteau|au poteau|d'un côté/i],
  ['crease', /bout portant|devant le filet|mêlée|cohue|retour|dévi|s'acharne|circulation|pousse la rondelle|se libère devant|forêt de jambes|lucarne|barre horizontale|jambières|se couche/i],
  ['enclave', /enclave|deuxième vague|se démarque|seul devant|se présente seul|devant|sur réception|prend son temps|feinte|revirement|garde la rondelle|termine lui-même/i],
];
/* Le côté que le texte dit, vu du tireur qui regarde le filet : −1 la gauche, +1 la droite, 0 rien. */
export function coteDuTexte(texte) {
  const t = String(texte || '');
  return /\bgauche\b/i.test(t) ? -1 : /\bdroite\b/i.test(t) ? 1 : 0;
}
export function zoneDuTexte(texte) {
  const t = String(texte || '');
  for (const [zone, re] of MOTS) if (re.test(t)) return zone;
  return null;
}

/* D'où tire chaque rôle (les poids d'une zone) : un attaquant, puis un défenseur. */
const POIDS_F = {
  sniper: { cercle: 3, enclave: 3, crease: 1, aile: 1, angle: 0.5, ligneBleue: 0.3 },
  power: { crease: 4, enclave: 2, angle: 1.5, cercle: 0.7 },
  passeur: { aile: 2.5, cercle: 2, enclave: 2, ligneBleue: 0.7 },
  deuxsens: { enclave: 2, cercle: 1.5, crease: 1.5, aile: 1 },
  checker: { enclave: 2, crease: 2, angle: 1, echappee: 0.8 },
  energie: { crease: 3, enclave: 1.5, angle: 1.5 },
  bagarreur: { crease: 3.5, angle: 1.5, enclave: 0.8 },
  aucun: { enclave: 1.5, cercle: 1.5, crease: 1.5, aile: 1, angle: 1 },
};
const POIDS_D = {
  offensif: { pointe: 4, ligneBleue: 3, cercle: 1, enclave: 0.7 },
  manieur: { ligneBleue: 3.5, pointe: 2, aile: 1.5 },
  defensif: { pointe: 4, ligneBleue: 1.5 },
  physique: { pointe: 3, ligneBleue: 2 },
  deuxsens: { pointe: 3, ligneBleue: 2.5, cercle: 0.7 },
  aucun: { pointe: 3, ligneBleue: 2 },
};
/* L'accord du trio (AFFINITES) pousse des zones : ses coéquipiers, dits par leurs rôles. */
const ACCORDS = {
  tir: { enclave: 2, cercle: 1.5 },          // la passe et le tir : le tir sur réception, dans la fente
  filet: { crease: 2.5, enclave: 1.5 },      // l'enclave : devant le filet
  rebonds: { crease: 3, angle: 1.5 },        // les rebonds : sur le retour
  echec: { crease: 1.8, enclave: 1.3 },      // l'échec avant : une rondelle volée, tout près
  energie: { crease: 1.6 },                  // les plombiers : au ras du filet
  trappe: { aile: 1.5, ligneBleue: 1.5 },    // la trappe : peu de danger, de loin
  sortie: { echappee: 3, aile: 1.5 },        // la sortie rapide : en échappée
  pointe: { pointe: 1.5, crease: 2 },        // la pointe et l'écran : un tir de loin, une déviation
};

/* Le rôle principal d'un tireur : son premier badge (js/sim.js `badgesDe`), ou rien. */
function roleDuTireur(p) {
  const b = p ? badgesDe(p)[0] : null;
  return b ? { cle: b.cle, ico: b.ico, nom: b.nom } : null;
}

/*
 * LE MODÈLE : la zone d'un tir d'après ce que la feuille sait. `t` va de 0 (un tir de loin, sans danger) à 1 (le plus
 * dangereux) et tient la distance : les zones de danger pèsent plus quand `t` monte, les zones de loin pèsent moins.
 */
export function zoneDuModele({ tireur, acc = null, p = null, mode = null, special = null, but = false, cle }) {
  const defenseur = !!tireur && /^(D|LD|RD)$/.test(tireur.p);
  const role = roleDuTireur(tireur);
  const base = (defenseur ? POIDS_D : POIDS_F)[role ? role.cle : 'aucun'] || (defenseur ? POIDS_D : POIDS_F).aucun;
  const pp = p != null ? p : (but ? 0.2 : 0.09);
  let t = Math.max(0, Math.min(1, (pp - 0.03) / 0.22));
  if (but) t = Math.max(t, 0.5);                         // un but vient de près, plus souvent
  if (special === 'reussie') t = Math.max(t, 0.65);
  const poids = {};
  for (const k of CLES) {
    let w = base[k] || 0.05;
    const pres = ZONES[k].pres;
    w *= pres ? 0.3 + 1.7 * t : 1.7 - 1.4 * t;
    if (!defenseur && acc && ACCORDS[acc] && ACCORDS[acc][k]) w *= ACCORDS[acc][k];
    if (defenseur && acc === 'pointe' && ACCORDS.pointe[k]) w *= ACCORDS.pointe[k];
    if (mode === 'AN') w *= (k === 'cercle' || k === 'enclave' || k === 'pointe') ? 1.5 : 1;
    if (mode === 'DN') w *= k === 'echappee' ? 3 : 0.7;
    if (special === 'etouffee') w *= pres ? 0.4 : 1.6;
    poids[k] = w;
  }
  let r = hache('zone', cle) * CLES.reduce((s, k) => s + poids[k], 0);
  for (const k of CLES) { r -= poids[k]; if (r <= 0) return k; }
  return CLES[CLES.length - 1];
}

/* Un point de la zone, pour un camp qui attaque vers la droite (+1) ou la gauche (−1). */
function pointDansLaZone(zone, sens, cle, cote = 0) {
  const Z = ZONES[zone] || ZONES.enclave;
  const lerp = ([a, b], h) => a + (b - a) * h;
  const u = lerp(Z.u, hache('u', cle));
  const v = lerp(Z.v, hache('v', cle)) * (cote || (hache('cote', cle) < 0.5 ? -1 : 1));
  const x = sens === 1 ? BUT_X - u : LONGUEUR - BUT_X + u;
  return { x: Math.round(x * 10) / 10, y: Math.round((MILIEU + (sens === 1 ? v : -v)) * 10) / 10 };
}

/*
 * LA POSITION D'UN TIR. `e` est un événement du direct : { type: 'arret' | 'but', cote, instant, tireur, p, acc, mode,
 * special, but }. Un but prend la zone de son texte du sommaire quand il en dit une ; tout le reste, le modèle.
 */
export function positionDuTir(e) {
  const but = e.type === 'but';
  const joueur = but ? (e.but && e.but.marqueur) : e.tireur;
  const cle = `${e.cote}|${(e.instant || 0).toFixed(3)}|${joueur && joueur.n ? joueur.n : '?'}`;
  const info = but ? e.but : e;
  let texte = null, zone = null, cote = 0;
  if (but && e.but && e.but.marqueur) {
    // Le même texte que le sommaire (js/bilan.js lit `recitDeBut(b)` sur ce but) : le même objet, la même phrase.
    try { texte = recitDeBut(e.but); } catch { texte = null; }
    zone = zoneDuTexte(texte);
    cote = coteDuTexte(texte);
  }
  const duTexte = !!zone;
  if (!zone) zone = zoneDuModele({ tireur: joueur, acc: info.acc || null, p: info.p != null ? info.p : null, mode: info.mode || (info.an ? 'AN' : info.dn ? 'DN' : null), special: info.special || null, but, cle });
  const per = e.instant >= 60 ? 4 : Math.min(3, Math.floor((e.instant || 0) / 20) + 1);
  const sens = per === 2 ? (e.cote === 'A' ? -1 : 1) : (e.cote === 'A' ? 1 : -1);
  const { x, y } = pointDansLaZone(zone, sens, cle, cote);
  return { x, y, zone, cote, duTexte, texte, role: roleDuTireur(joueur), accord: info.acc ? (AFFINITES.find(a => a.cle === info.acc) || {}).nom || null : null, but };
}

/* ---------- le dessin : la patinoire en SVG, aplat, sans effet ---------- */

/* Le rayon d'un point : un but se voit, un tir étouffé s'efface. */
const rayon = e => (e.type === 'but' ? 3.6 : e.special === 'etouffee' ? 1.7 : 2.3);

const CERCLES = [[169, 20.5], [169, 64.5], [31, 20.5], [31, 64.5]];
function patinoireSvg() {
  const l = (x1, y1, x2, y2, cls) => `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  return `<svg class="gl-svg" viewBox="0 0 ${LONGUEUR} ${LARGEUR}" role="img" aria-label="La patinoire : chaque tir, là où il s'est posé (emplacement illustratif)" preserveAspectRatio="xMidYMid meet">
    <rect class="gl-glace" x="0.5" y="0.5" width="${LONGUEUR - 1}" height="${LARGEUR - 1}" rx="28" ry="28"/>
    ${l(100, 1, 100, LARGEUR - 1, 'gl-rouge')}${l(75, 1, 75, LARGEUR - 1, 'gl-bleue')}${l(125, 1, 125, LARGEUR - 1, 'gl-bleue')}
    ${l(11, 6, 11, LARGEUR - 6, 'gl-but')}${l(189, 6, 189, LARGEUR - 6, 'gl-but')}
    <circle class="gl-cercle gl-rouge" cx="100" cy="${MILIEU}" r="15"/>
    ${CERCLES.map(([x, y]) => `<circle class="gl-cercle" cx="${x}" cy="${y}" r="15"/>`).join('')}
    <path class="gl-creux" d="M189 ${MILIEU - 6} a6 6 0 0 0 0 12 z"/><path class="gl-creux" d="M11 ${MILIEU - 6} a6 6 0 0 1 0 12 z"/>
    <rect class="gl-filet" x="189" y="${MILIEU - 3}" width="3" height="6"/><rect class="gl-filet" x="8" y="${MILIEU - 3}" width="3" height="6"/>
    <g class="gl-tirs"></g>
  </svg>`;
}

/*
 * LA GLACE D'UN DIRECT : un conteneur, deux camps (`couleurs` : { A, B }, des couleurs CSS), un nom de joueur.
 * `ajouter(e)` pose un point (un fondu, une seule fois) et dit le dernier tir dessous ; `vider()` repart à zéro.
 */
export function creerGlace(conteneur, { couleurs, nomDe = p => (p && p.n) || '' } = {}) {
  conteneur.innerHTML = `${patinoireSvg()}<div class="gl-dit" aria-live="off"></div>`;
  const NS = 'http://www.w3.org/2000/svg';
  const g = conteneur.querySelector('.gl-tirs'), dit = conteneur.querySelector('.gl-dit');
  conteneur.style.setProperty('--gl-a', couleurs.A);
  conteneur.style.setProperty('--gl-b', couleurs.B);
  let n = 0;
  return {
    get n() { return n; },
    ajouter(e, { muet = false } = {}) {
      if (e.type !== 'arret' && e.type !== 'but') return null;
      const pos = positionDuTir(e);
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', pos.x); c.setAttribute('cy', pos.y);
      c.setAttribute('r', rayon(e));
      c.setAttribute('class', `gl-pt ${e.cote === 'A' ? 'a' : 'b'}${e.type === 'but' ? ' but' : ''}${muet ? ' fixe' : ''}`);
      g.appendChild(c);
      n++;
      if (!muet) {
        const joueur = e.type === 'but' ? e.but && e.but.marqueur : e.tireur;
        dit.textContent = `${pos.role ? `${pos.role.ico} ` : ''}${nomDe(joueur)} · ${ZONES[pos.zone].nom}${pos.accord ? ` · ${pos.accord}` : ''}${e.type === 'but' ? ' · but' : ''}`;
      }
      return pos;
    },
    vider() { g.innerHTML = ''; dit.textContent = ''; n = 0; },
  };
}

/*
 * LES TIRS D'UNE FEUILLE, comme js/direct.js les lit : un arrêt par lancer qui n'est pas un but, un but par but de la
 * feuille. Une feuille d'avant (sans `lancers`) n'a pas de tireur ni de chance : elle n'a pas de glace.
 */
export function evenementsDeFeuille(f) {
  if (!f || !f.lancers || !f.lancers.length) return [];
  return [
    ...f.lancers.filter(l => !l.but).map(l => ({ type: 'arret', cote: l.cote, instant: l.instant, tireur: l.tireur, p: l.p, special: l.special, mode: l.mode, acc: l.acc })),
    ...f.buts.map(b => ({ type: 'but', cote: b.cote, instant: b.instant, but: b })),
  ];
}

/* La glace d'un match fini (le sommaire) : tous ses tirs d'un coup, fixes, les mêmes points que le direct a posés. */
export function glaceDuMatchHtml(f, { couleurs }) {
  const evs = evenementsDeFeuille(f);
  if (!evs.length) return '';
  const pts = evs.map(e => ({ e, pos: positionDuTir(e) }));
  const dot = ({ e, pos }) => `<circle class="gl-pt fixe ${e.cote === 'A' ? 'a' : 'b'}${e.type === 'but' ? ' but' : ''}" cx="${pos.x}" cy="${pos.y}" r="${rayon(e)}"/>`;
  const svg = patinoireSvg().replace('<g class="gl-tirs"></g>', `<g class="gl-tirs">${pts.map(dot).join('')}</g>`);
  return `<div class="som-glace" style="--gl-a:${couleurs.A};--gl-b:${couleurs.B}">${svg}<div class="gl-dit">${evs.length} tirs · un gros point est un but · emplacements illustratifs</div></div>`;
}
