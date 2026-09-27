/**
 * LE PRONOSTIC (S78) : ce que le MOTEUR pense d'un match avant qu'on le
 * regarde. JP : *avant match, mettre forces comparatives … avec chances de
 * victoire et conditions de victoire et de défaite pour chaque équipe, basé
 * dans les vraies probabilités et équipes, pas inventés*.
 *
 * RIEN N'EST INVENTÉ ICI : on rejoue le match des centaines de fois avec le
 * vrai moteur (`playGame`), sur les deux vrais clubs, tels qu'ils sont au
 * matin de la journée — les blessés du jour, l'énergie et la chimie de
 * l'instantané que le moteur a pris ce matin-là (`jourLignes`) — et on
 * compte. Les chances de victoire, les buts attendus et les « conditions »
 * (« quand tu marques trois buts, tu gagnes 72 % de ces matchs ») sont des
 * fréquences de ces matchs-là, rien d'autre.
 *
 * CE QUI N'Y ENTRE PAS, exprès : la chance de saison de chaque club
 * (`luck`, un dé caché que le moteur tire en début de saison — la montrer
 * dirait le dé), et la mise en scène d'un gros match (le plan adverse, ta
 * main de cartes) : le pronostic est celui du match nu, à forces égales.
 *
 * RIEN NE BOUGE : le hasard est isolé (`avecHasardIsole` : la saison et les
 * séries, qui continuent sa suite, retrouvent le générateur exactement où
 * il était), les clubs sont des copies, et chaque joueur touché retrouve
 * à la fin ses champs d'avant (`photographier`/`rendre`). `check_graine`,
 * `check_feuilles`, `check_ballottage` le prouvent en restant identiques.
 *
 * Le module est pur et sans DOM : js/saison.js l'affiche.
 */

import { playGame, avecHasardIsole, SLOTS, getPlayerKey, feuilleVierge, OBJECTIFS, MATCHS_OBJECTIF,
  TACTIQUES, SYSTEMES_D, AGRESSIVITES, contreDe, contreDeD, fitUnite, meilleureTactique, meilleurSystemeD, meilleureAgressivite,
  bilanAgressivite, physiqueLigne, effetsDeSysteme, effetDeMoment, identiteUnite, joueursDeLigne, profilsDe,
  SEC_MIN, SPEC_BASE, SPEC_MULT } from './sim.js';

/* Les joueurs qu'un match peut toucher : les deux alignements, et le gardien de rappel. */
const joueursDe = t => [...SLOTS.map(s => t.roster[s.i]).filter(Boolean), ...(t.rappelG ? [t.rappelG] : [])];

/* Une photo des champs de chaque joueur, pour les lui rendre tels quels après. */
function photographier(joueurs) {
  const vus = new Set();
  const out = [];
  for (const p of joueurs) if (p && !vus.has(p)) { vus.add(p); out.push([p, { ...p }]); }
  return out;
}
function rendre(photos) {
  for (const [p, ph] of photos) {
    for (const k of Object.keys(p)) if (!(k in ph)) delete p[k];
    Object.assign(p, ph);
  }
}

/*
 * LES MATCHS JOUÉS PAR UN CLUB avant une journée, lus au calendrier : c'est
 * ce qui règle la rotation des gardiens (`pickGoalie` lit `games`) et ce qui
 * dit quels blessés sont encore à l'infirmerie.
 */
export function matchsAvant(calendrier, t, jour) {
  let n = 0;
  for (let j = 0; j < Math.min(jour, calendrier.length); j++) for (const m of calendrier[j]) if (m.A === t || m.B === t) n++;
  return n;
}

/*
 * UN CLUB AU MATIN D'UNE JOURNÉE, en copie. `joues` : ses matchs avant ce
 * soir ; `connus` : ceux dont on a vu le résultat (on ne sort de
 * l'infirmerie que les blessures déjà arrivées). L'énergie, la chimie et
 * l'apprentissage viennent de l'instantané du moteur (`jourLignes`).
 */
function copieDuJour(t, { jourMatch, jourRevele, joues, connus }) {
  const snap = (t.jourLignes || [])[Math.max(0, Math.min(jourRevele, (t.jourLignes || []).length - 1))] || null;
  const injured = new Map();
  for (const b of t.injuriesLog || []) {
    if (b.at > connus) continue;
    const reste = b.at + b.games - joues;
    if (reste > 0) injured.set(b.player, reste);
  }
  const app = snap && snap.apprentissage;
  const tardives = new Set((t.mutations || []).filter(m => m.jour >= jourRevele && m.p).map(m => m.p));
  const avant = { injured };
  // Ce que chaque joueur est ce matin-là : l'énergie de l'instantané, sa
  // maîtrise des systèmes (ta formation), sans la situation d'un soir, sans
  // un changement de carte qui n'est pas encore arrivé.
  const poser = p => {
    const cle = getPlayerKey(p);
    p.energie = snap && snap.energie && Number.isFinite(snap.energie[cle]) ? snap.energie[cle] : 100;
    if (app && app.maitrise) p._maitrise = { ...(app.maitrise[cle] || {}) };
    else if (p._maitrise) p._maitrise = { ...p._maitrise };
    if (p._adapt) p._adapt = { ...p._adapt };
    delete p._situ;
    if (tardives.has(p)) { delete p._mut; delete p._mutProfils; delete p._mutCles; }
  };
  const copie = {
    ...t,
    injured, injuriesLog: [], trous: [], trouEnCours: false, journal: null,
    luck: 0, _gros: null, _effetMatch: null, _entracte: null, _advGros: null, _dernierGros: null,
    games: joues, jourCourant: jourMatch,
    chimie: snap && snap.chimie ? snap.chimie.slice() : (t.chimie || [0, 0, 0, 0]).slice(),
    entente: app && app.entente ? new Map(Object.entries(app.entente)) : new Map(t.entente || []),
    W: 0, L: 0, OTL: 0, GF: 0, GA: 0, PTS: 0,
  };
  return { copie, poser, avant };
}

/* Remet une copie au matin avant chaque simulation : les blessures d'un essai ne passent pas au suivant. */
function remettre(c) {
  c.copie.injured = new Map(c.avant.injured);
  c.copie.injuriesLog = []; c.copie.trous = []; c.copie.trouEnCours = false;
}

/*
 * LE PRONOSTIC D'UN MATCH : `n` matchs rejoués par le moteur, A à domicile
 * (comme au calendrier). Rend les fréquences brutes ; l'écran en tire les
 * mots. `n` = 300 donne ±3 points sur les chances de victoire.
 */
export function pronostic({ A, B, calendrier, jourMatch, jourRevele, n = 300, graine = 'pronostic' }) {
  const ctx = t => ({ jourMatch, jourRevele, joues: matchsAvant(calendrier, t, jourMatch), connus: matchsAvant(calendrier, t, jourRevele) });
  const cA = copieDuJour(A, ctx(A)), cB = copieDuJour(B, ctx(B));
  const photos = photographier([...joueursDe(A), ...joueursDe(B)]);
  const scores = new Map();   // « gfA-gfB-p » -> fois
  let vA = 0, prol = 0, butsA = 0, butsB = 0;
  // Les gardiens de ce soir : la rotation du moteur est sans hasard (`pickGoalie`), la première feuille les dit.
  let gardiens = { A: null, B: null };
  try {
    for (const p of joueursDe(A)) cA.poser(p);
    for (const p of joueursDe(B)) cB.poser(p);
    avecHasardIsole(`${graine}|${A.tag}|${B.tag}|${jourMatch}`, () => {
      for (let i = 0; i < n; i++) {
        remettre(cA); remettre(cB);
        const f = i === 0 ? feuilleVierge() : null;
        const r = playGame(cA.copie, cB.copie, jourMatch, false, false, f);
        if (f) gardiens = { A: f.gardienA || null, B: f.gardienB || null };
        if (r.gfA > r.gfB) vA++;
        if (r.ot) prol++;
        butsA += r.gfA; butsB += r.gfB;
        const k = `${r.gfA}-${r.gfB}-${r.ot ? 1 : 0}`;
        scores.set(k, (scores.get(k) || 0) + 1);
      }
    });
  } finally { rendre(photos); }
  const liste = [...scores].map(([k, fois]) => { const [a, b, o] = k.split('-').map(Number); return { a, b, ot: !!o, fois }; });
  return { n, vA, vB: n - vA, prol, butsA: butsA / n, butsB: butsB / n, scores: liste, gardiens };
}

/*
 * LES CONSEILS D'AVANT-MATCH (S79). JP, sur le dépistage : *le bas aide fuck
 * all aucun processus décisionnel*. « S'il marque quatre buts, il gagne »
 * disait une évidence ; un conseil dit QUOI FAIRE, avec un levier du jeu :
 *   contre       une unité passe au système qui ÉTOUFFE le système principal
 *                de leurs trois premiers trios (un trio : `contreDe` ; une
 *                paire : `contreDeD`) — celle qui y a le meilleur fit ;
 *   menace       leur trio ou leur paire du même rang étouffe le système d'un
 *                de tes trios : il passe au meilleur système qu'ils n'étouffent pas ;
 *   fit          l'unité la plus loin de son meilleur système y passe ;
 *   fermeture    ton trio le plus défensif (ses rôles) prend leur 1er trio ;
 *   agressivite  chaque ligne à l'agressivité qui paie pour sa carrure ;
 *   glace        un des deux premiers trios est usé : moins de glace ;
 *   consigne     attaque ou défense, selon les forces comparées.
 * Chaque conseil porte la décision que l'écran applique d'un toucher
 * (`lignes`, `fermeture` ou `match`) — une décision comme une autre, qui
 * se rejoue — et ses chiffres sont ceux du moteur : ce que le système fait à
 * CE fit (`effetsDeSysteme`), ce que l'agressivité rend à CETTE carrure
 * (`bilanAgressivite`), la chance d'action spéciale (`SPEC_BASE` × chimie)
 * et ce qu'elle vaut (`SPEC_MULT`), l'énergie du matin.
 *
 * POURQUOI PAS « +3 POINTS DE VICTOIRE » ? Mesuré en S79 : un réglage d'une
 * ligne vaut un point ou deux sur un match, et 200 matchs rejoués en donnent
 * ±5 — le même levier sortait à +9 avec une graine et à 0 avec une autre. Le
 * chiffre aurait été du bruit présenté comme une mesure.
 *
 * Entrées : `lineup` (tes cases), `lignes` (tes lignes de la saison),
 * `fermeture` ('auto', null ou un rang), `energie` (clé → %), `adv`
 * ({ lignes, chimie, lineup }), `forces` ({ moi: { attaque, defense },
 * lui: { attaque, gardien } }, chacun { rang, sur } ou null) et `consigne`
 * (celle déjà prise pour ce match, ou null).
 */
const RANG_TRIO = ['1er trio', '2e trio', '3e trio', '4e trio'];
const RANG_PAIRE = ['1re paire', '2e paire', '3e paire'];
const RANG_LIGNE = ['1re ligne', '2e ligne', '3e ligne', '4e ligne'];
const nomSysteme = k => { const S = TACTIQUES[k] || SYSTEMES_D[k]; return S ? `${S.ico} ${S.nom}` : ''; };
const motFit = f => (f >= 70 ? 'sur mesure' : f >= 55 ? 'bon fit' : f >= 40 ? 'fit moyen' : 'mauvais fit');
const virgule = x => String(x).replace('.', ',');
const pctE = v => `${v >= 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)} %`;
export function conseilsDuMatch({ lineup, lignes, fermeture = 'auto', energie = {}, adv = null, forces = null, consigne = null }) {
  const out = [];
  const avec = (u, patch) => lignes.map((l, i) => (i === u ? { ...l, ...patch } : { ...l }));
  const fitDe = (g, u, k) => (k && k !== 'hourra' && (g === 'D' ? SYSTEMES_D : TACTIQUES)[k] ? fitUnite(lineup, g, u, k) : 0);
  const nomUnite = (g, u) => (g === 'D' ? RANG_PAIRE[u] : RANG_TRIO[u]);
  const idDe = (L, g, u) => { const id = L && identiteUnite(L, g, u); return id ? id.nom : ''; };
  const touche = new Set();   // une unité, un conseil
  const chiffresSys = (g, u, k) => effetsDeSysteme((g === 'D' ? SYSTEMES_D : TACTIQUES)[k], fitDe(g, u, k)).map(({ txt, bon }) => ({ txt, bon }));

  if (adv && adv.lignes) {
    // LEUR SYSTÈME PRINCIPAL : leurs trois premiers trios, pondérés 3-2-1.
    const poids = {};
    adv.lignes.slice(0, 3).forEach((l, u) => { if (TACTIQUES[l.tac] && TACTIQUES[l.tac].slots) poids[l.tac] = (poids[l.tac] || 0) + 3 - u; });
    const X = (Object.entries(poids).sort((a, b) => b[1] - a[1])[0] || [])[0];
    if (X) {
      const leurs = [0, 1, 2].filter(u => adv.lignes[u] && adv.lignes[u].tac === X);
      const chim = Math.max(0, ...leurs.map(u => (adv.chimie || [])[u] || 0));
      const surN = chim >= 5 ? Math.round(100 / (SPEC_BASE * chim)) : null;
      const leursMots = `leur ${nomSysteme(X)} (${leurs.map(u => RANG_TRIO[u]).join(', ')})`;
      const deja = [...[0, 1, 2, 3].filter(u => TACTIQUES[lignes[u].tac] && TACTIQUES[lignes[u].tac].bat === X).map(u => `ton ${RANG_TRIO[u]}`),
        ...[0, 1, 2].filter(u => SYSTEMES_D[lignes[u].tacD] && SYSTEMES_D[lignes[u].tacD].bat === X).map(u => `ta ${RANG_PAIRE[u]}`)];
      const action = surN ? `son action spéciale — environ 1 tir sur ${surN} de ces trios, qui entre ${virgule(SPEC_MULT)} fois plus souvent —` : 'son action spéciale';
      if (deja.length) out.push({ genre: 'deja', titre: `${leursMots[0].toUpperCase()}${leursMots.slice(1)} est déjà étouffé`, pourquoi: `Par ${deja.join(' et ')} : ${action} ne passe pas quand ${deja.length > 1 ? 'ils sont' : deja[0].startsWith('ta') ? 'elle est' : 'il est'} sur la glace.`, chiffres: [] });
      else {
        const essais = [];
        for (const [g, cle, champ, unites] of [['F', contreDe(X), 'tac', [0, 1, 2]], ['D', contreDeD(X), 'tacD', [0, 1, 2]]]) {
          if (!cle) continue;
          for (const u of unites) essais.push({ g, cle, champ, u, fit: fitDe(g, u, cle), perte: fitDe(g, u, lignes[u][champ]) - fitDe(g, u, cle) });
        }
        // Le meilleur fit d'abord ; à fit égal, celui qui perd le moins à quitter son système.
        const c = essais.filter(e => e.fit >= 45).sort((a, b) => b.fit - a.fit || a.perte - b.perte)[0];
        if (c) {
          touche.add(`${c.g}${c.u}`);
          const avant = lignes[c.u][c.champ];
          out.push({ genre: 'contre', lignes: avec(c.u, { [c.champ]: c.cle }),
            titre: `${c.g === 'D' ? 'Ta' : 'Ton'} ${nomUnite(c.g, c.u)} en ${nomSysteme(c.cle)}`,
            pourquoi: `${c.g === 'D' ? 'Elle' : 'Il'} étouffe ${leursMots} : ${action} ne passe plus quand ${c.g === 'D' ? 'ta paire' : 'ton trio'} est sur la glace. ${idDe(lineup, c.g, c.u) ? `${idDe(lineup, c.g, c.u)} : ` : ''}${motFit(c.fit)}${avant && avant !== 'hourra' ? ` (il jouait ${nomSysteme(avant)}, ${motFit(fitDe(c.g, c.u, avant))})` : ''}.`,
            chiffres: chiffresSys(c.g, c.u, c.cle) });
        }
      }
    }
    // LEUR SYSTÈME ÉTOUFFE LE TIEN : le trio adverse du même rang, ou sa paire.
    for (const u of [0, 1, 2]) {
      const mien = lignes[u].tac, a = adv.lignes[u] || {};
      if (touche.has(`F${u}`) || !TACTIQUES[mien] || !TACTIQUES[mien].slots) continue;
      const parTrio = TACTIQUES[a.tac] && TACTIQUES[a.tac].bat === mien, parPaire = SYSTEMES_D[a.tacD] && SYSTEMES_D[a.tacD].bat === mien;
      if (!parTrio && !parPaire) continue;
      const libres = Object.keys(TACTIQUES).filter(k => k !== 'hourra' && k !== mien && TACTIQUES[a.tac]?.bat !== k && SYSTEMES_D[a.tacD]?.bat !== k)
        .sort((x, y) => fitDe('F', u, y) - fitDe('F', u, x));
      const k = libres[0];
      // Pas pour un système où il serait mal assorti : on perdrait plus qu'une action spéciale.
      if (!k || fitDe('F', u, k) < 40 || fitDe('F', u, k) < fitDe('F', u, mien) - 10) continue;
      touche.add(`F${u}`);
      out.push({ genre: 'menace', lignes: avec(u, { tac: k }), titre: `Ton ${RANG_TRIO[u]} en ${nomSysteme(k)}`,
        pourquoi: `${parTrio ? `Leur ${RANG_TRIO[u]} en ${nomSysteme(a.tac)}` : `Leur ${RANG_PAIRE[u]} en ${nomSysteme(a.tacD)}`} étouffe ton ${nomSysteme(mien)} : ton action spéciale ne passerait pas. ${nomSysteme(k)} : ${motFit(fitDe('F', u, k))}.`,
        chiffres: chiffresSys('F', u, k) });
      break;
    }
  }
  // LE FIT : l'unité la plus loin de son meilleur système (10 points ou plus), une par groupe.
  for (const [g, champ, unites, meilleur] of [['F', 'tac', [0, 1, 2, 3], meilleureTactique], ['D', 'tacD', [0, 1, 2], meilleurSystemeD]]) {
    let pire = null;
    for (const u of unites) {
      if (touche.has(`${g}${u}`)) continue;
      const m = meilleur(lineup, u), cur = lignes[u][champ];
      const ecart = fitDe(g, u, m) - fitDe(g, u, cur);
      if (m !== cur && ecart >= 10 && (!pire || ecart > pire.ecart)) pire = { u, m, cur, ecart };
    }
    if (!pire) continue;
    touche.add(`${g}${pire.u}`);
    const id = idDe(lineup, g, pire.u);
    out.push({ genre: 'fit', lignes: avec(pire.u, { [champ]: pire.m }), titre: `${g === 'D' ? 'Ta' : 'Ton'} ${nomUnite(g, pire.u)} en ${nomSysteme(pire.m)}`,
      pourquoi: `${id ? `${id} : ` : ''}${motFit(fitDe(g, pire.u, pire.m))} en ${nomSysteme(pire.m)}, ${pire.cur && pire.cur !== 'hourra' ? `${motFit(fitDe(g, pire.u, pire.cur))} en ${nomSysteme(pire.cur)}` : 'sans système'}. Le gain d'un système suit le fit de ses joueurs.`,
      chiffres: chiffresSys(g, pire.u, pire.m) });
  }
  // LA FERMETURE : ton trio le plus défensif — ses checkers et ses two-way, lus dans leurs vraies stats — prend leur 1er trio.
  const ferm = fermeture === 'auto' ? 2 : fermeture;
  const defenseDe = u => { const js = Object.entries(joueursDeLigne(lineup, u)).filter(([r, p]) => p && r !== 'DG' && r !== 'DD').map(([, p]) => profilsDe(p) || {});
    return js.length === 3 ? js.reduce((a, pr) => a + Math.max(pr.checker || 0, pr.deuxsens || 0), 0) / 3 : 0; };
  const defensif = [0, 1, 2, 3].sort((a, b) => defenseDe(b) - defenseDe(a))[0];
  if (defensif !== 0 && defensif !== ferm && defenseDe(defensif) >= (ferm == null ? 0 : defenseDe(ferm)) + 10) {
    const leur = adv && adv.lineup ? idDe(adv.lineup, 'F', 0) : '';
    const id = idDe(lineup, 'F', defensif);
    out.push({ genre: 'fermeture', fermeture: defensif, titre: `Ton ${RANG_TRIO[defensif]} en fermeture`,
      pourquoi: `Le trio de fermeture prend leur 1er trio${leur ? ` (${leur})` : ''}. ${id ? `Ton ${RANG_TRIO[defensif]} est un ${id.replace(/^Trio/, 'trio')}` : `Ton ${RANG_TRIO[defensif]}`} : ses joueurs sont les plus défensifs de ta formation${ferm == null ? '' : `, plus que ton ${RANG_TRIO[ferm]}`}.`, chiffres: [] });
  }
  // L'AGRESSIVITÉ qui paie pour la carrure de chaque ligne.
  const mieux = lignes.map((l, u) => meilleureAgressivite(lineup, u));
  const changees = [0, 1, 2, 3].filter(u => mieux[u] !== lignes[u].agr);
  if (changees.length) {
    out.push({ genre: 'agressivite', lignes: lignes.map((l, u) => ({ ...l, agr: mieux[u] })),
      titre: changees.map(u => `${RANG_LIGNE[u]} ${AGRESSIVITES[mieux[u]].ico} ${AGRESSIVITES[mieux[u]].nom.toLowerCase()}`).join(' · '),
      pourquoi: 'L\'agressivité qui paie pour la carrure de chaque ligne : le jeu physique rapporte aux lignes costaudes et coûte des punitions aux légères.',
      // Ce que ça change, ligne par ligne, par rapport à son agressivité d'aujourd'hui.
      chiffres: changees.slice(0, 2).map(u => {
        const ph = physiqueLigne(lineup, u);
        const b = bilanAgressivite(mieux[u], ph), a = bilanAgressivite(lignes[u].agr ?? 1, ph);
        const dB = Math.round((a.defense - b.defense) * 100), dP = Math.round((b.punitions - a.punitions) * 100);
        const sg = x => `${x > 0 ? '+' : '−'}${Math.abs(x)} %`;
        return { txt: `${RANG_LIGNE[u]} : ${[dB ? `buts contre ${sg(dB)}` : '', dP ? `punitions ${sg(dP)}` : ''].filter(Boolean).join(', ') || 'presque rien'}`, bon: b.net > a.net };
      }) });
  }
  // LA GLACE : un des deux premiers trios usé (70 % et moins d'énergie ce matin).
  for (const u of [0, 1]) {
    const js = Object.entries(joueursDeLigne(lineup, u)).filter(([r, p]) => p && r !== 'DG' && r !== 'DD').map(([, p]) => energie[getPlayerKey(p)]).filter(Number.isFinite);
    const moy = js.length ? js.reduce((a, x) => a + x, 0) / js.length : 100;
    if (moy > 70 || lignes[u].sec <= SEC_MIN) continue;
    const sec = Math.max(SEC_MIN, lignes[u].sec - 15);
    out.push({ genre: 'glace', lignes: avec(u, { sec }), titre: `Ton ${RANG_TRIO[u]} : ${sec} s par présence`,
      pourquoi: `Il est usé : ${Math.round(moy)} % d'énergie ce matin. Sous 60 %, un joueur rend moins et se blesse plus ; moins de glace ce soir, c'est plus de jambes au prochain.`,
      chiffres: [{ txt: `Énergie ${Math.round(moy)} %`, bon: false }] });
    break;
  }
  // LA CONSIGNE, selon les forces comparées (rangs de la ligue).
  const tiers = r => (r && r.sur > 1 ? (r.rang - 1) / (r.sur - 1) : null);
  if (consigne == null && forces) {
    const gL = tiers(forces.lui && forces.lui.gardien), aM = tiers(forces.moi && forces.moi.attaque);
    const aL = tiers(forces.lui && forces.lui.attaque), dM = tiers(forces.moi && forces.moi.defense);
    const ad = gL != null && aM != null && gL >= 2 / 3 && aM <= 0.5 ? 2 : aL != null && dM != null && aL <= 1 / 3 && dM >= 0.5 ? -2 : 0;
    if (ad) {
      const match = { importance: 'normale', ad };
      out.push({ genre: 'consigne', match, titre: ad > 0 ? '🎯 Consigne : attaque' : '🛡️ Consigne : défense',
        pourquoi: ad > 0 ? `Leur gardien de ce soir est ${forces.lui.gardien.rang}e de la ligue, ton attaque ${forces.moi.attaque.rang}${forces.moi.attaque.rang === 1 ? 're' : 'e'} : force-le.`
          : `Leur attaque est ${forces.lui.attaque.rang}${forces.lui.attaque.rang === 1 ? 're' : 'e'} de la ligue, ta défense ${forces.moi.defense.rang}e : ferme le jeu.`,
        chiffres: (e => [{ txt: `Précision ${pctE(e.finition)}`, bon: e.finition > 1 }, { txt: `Buts contre ${pctE(e.defense)}`, bon: e.defense < 1 }])(effetDeMoment({ jour: 0, match })) });
    }
  }
  return out;
}

/*
 * LES CONDITIONS, lues dans les mêmes matchs. Pour un côté (`'A'` ou `'B'`) :
 * le seuil de buts qui fait gagner (le plus petit « k buts ou plus » après
 * lequel ce côté gagne au moins les deux tiers du temps), et celui qui fait
 * perdre (le plus petit nombre de buts ENCAISSÉS à partir duquel il perd au
 * moins les deux tiers du temps). Chacun avec sa fréquence : combien de fois
 * ça arrive, et ce que ça donne quand ça arrive.
 */
export function conditions(pr, cote) {
  const pour = s => (cote === 'A' ? s.a : s.b), contre = s => (cote === 'A' ? s.b : s.a);
  const gagne = s => pour(s) > contre(s);
  const seuil = (garde, bon) => {
    for (let k = 1; k <= 8; k++) {
      const ici = pr.scores.filter(s => garde(s, k));
      const fois = ici.reduce((a, s) => a + s.fois, 0);
      if (fois < pr.n * 0.08) break;
      // Une condition qui arrive presque toujours ne dit rien (un match à sens unique) : on cherche plus loin.
      if (fois > pr.n * 0.85) continue;
      const reussis = ici.filter(bon).reduce((a, s) => a + s.fois, 0);
      if (reussis / fois >= 2 / 3) return { k, arrive: fois / pr.n, alors: reussis / fois };
    }
    return null;
  };
  return {
    gagne: seuil((s, k) => pour(s) >= k, gagne),
    perd: seuil((s, k) => contre(s) >= k, s => !gagne(s)),
  };
}

/*
 * LES OBJECTIFS DU PROPRIO, à l'épreuve du moteur (S78). JP : *donner vague
 * idée de si c'est possible, genre si goaler à chier, blanchissage tough*.
 * On joue `chemins` fois tes vingt prochains matchs — les vrais adversaires
 * du calendrier, dans l'ordre, tes blessés s'accumulant d'un match à l'autre
 * comme dans une vraie séquence — et on compte combien de fois chaque
 * objectif tient. C'est la chance que le moteur lui donne, sans rien savoir
 * de la saison déjà jouée : ce sont d'autres dés, isolés.
 */
export function chancesDesObjectifs({ you, calendrier, jourRevele, cles, chemins = 40, graine = 'objectifs' }) {
  const suite = [];
  for (let j = jourRevele; j < calendrier.length && suite.length < MATCHS_OBJECTIF; j++) {
    const m = calendrier[j].find(x => x.A === you || x.B === you);
    if (m) suite.push({ j, A: m.A, B: m.B, adv: m.A === you ? m.B : m.A });
  }
  if (!suite.length) return {};
  for (const s of suite) s.jouesAdv = matchsAvant(calendrier, s.adv, s.j);
  const advs = [...new Set(suite.map(s => s.adv))];
  const joues0 = matchsAvant(calendrier, you, suite[0].j);
  const copieToi = copieDuJour(you, { jourMatch: suite[0].j, jourRevele, joues: joues0, connus: matchsAvant(calendrier, you, jourRevele) });
  const copiesAdv = new Map(advs.map(t => [t, copieDuJour(t, { jourMatch: suite[0].j, jourRevele, joues: matchsAvant(calendrier, t, jourRevele), connus: matchsAvant(calendrier, t, jourRevele) })]));
  const photos = photographier([...joueursDe(you), ...advs.flatMap(joueursDe)]);
  const tient = Object.fromEntries(cles.map(k => [k, 0]));
  try {
    for (const p of joueursDe(you)) copieToi.poser(p);
    for (const t of advs) for (const p of joueursDe(t)) copiesAdv.get(t).poser(p);
    avecHasardIsole(`${graine}|${you.tag}|${jourRevele}`, () => {
      for (let c = 0; c < chemins; c++) {
        // Tes blessés s'accumulent le long d'un chemin, comme dans une vraie séquence ; chaque chemin repart du matin.
        remettre(copieToi);
        copieToi.copie.games = joues0;
        const matchs = [];
        for (const s of suite) {
          const adv = copiesAdv.get(s.adv);
          remettre(adv);
          adv.copie.games = s.jouesAdv;
          const moiA = s.A === you;
          const f = feuilleVierge();
          const A = moiA ? copieToi.copie : adv.copie, B = moiA ? adv.copie : copieToi.copie;
          A.jourCourant = s.j; B.jourCourant = s.j;
          const r = playGame(A, B, s.j, false, false, f);
          const pour = moiA ? r.gfA : r.gfB, contre = moiA ? r.gfB : r.gfA;
          matchs.push({ v: pour > contre, pour, contre, buts: f.buts.filter(b => b.cote === (moiA ? 'A' : 'B')) });
          copieToi.copie.games++;
        }
        for (const k of cles) {
          const O = OBJECTIFS[k];
          if (!O) continue;
          const val = O.mesure(matchs);
          if (O.sens > 0 ? val >= O.cible : val <= O.cible) tient[k]++;
        }
      }
    });
  } finally { rendre(photos); }
  return Object.fromEntries(cles.map(k => [k, tient[k] / chemins]));
}

/* Une chance en mots : ce que le proprio entendrait de son adjoint. */
export function motDeChance(x) {
  if (x >= 0.7) return { cle: 'probable', mot: 'Probable' };
  if (x >= 0.45) return { cle: 'jouable', mot: 'Jouable' };
  if (x >= 0.2) return { cle: 'coriace', mot: 'Coriace' };
  return { cle: 'long', mot: 'Très dur' };
}
