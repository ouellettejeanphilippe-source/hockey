/**
 * LE RAPPORT D'ENTRACTE — des tableaux qui se balaient, pas des phrases.
 *
 * JP : *au lieu de résumé en phrases, trop répétitives, fait un genre de
 * tableau de stats, des tableaux même, style ce qu'on voit pendant les
 * entractes ? Swippable sur mobile, qui résument la saison, les matchs.*
 *
 * Le bilan racontait la saison en cinq paragraphes tirés d'une banque de
 * tournures : au bout de trois saisons, on reconnaissait les phrases, et une
 * phrase reconnue ne dit plus rien. Une télédiffusion, elle, ne raconte pas
 * l'entracte : elle SORT DES CARTONS — la fiche, les tirs, l'avantage
 * numérique, les meneurs, les trois étoiles — et le spectateur lit ce qu'il
 * veut. C'est ce que fait ce module.
 *
 * Un **deck** est une rangée de cartes qu'on balaie du doigt (`scroll-snap`),
 * avec des points dessous pour dire où on est. Chaque carte est un carton :
 * un titre, et dedans une grille de gros chiffres, une liste, ou un tableau.
 * Rien n'est inventé — tout vient des compteurs du moteur et des feuilles de
 * match, comme le reste de l'interface.
 *
 * Le module est aveugle aux données du jeu : `ctx` porte les fonctions
 * d'affichage de js/game.js (échappement, noms d'équipe, écussons).
 */

import { SLOTS } from './sim.js';

/* ---------- les briques d'une carte ---------- */

const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const virgule = x => String(x).replace('.', ',');
const signe = n => (n > 0 ? `+${n}` : `${n}`);
const pct3 = x => virgule(x.toFixed(3).replace(/^0/, ''));
const un = (x, n = 1) => virgule(x.toFixed(n));
const rangCourt = r => `${r}${r === 1 ? 'er' : 'e'}`;

/** Les gros chiffres d'un carton : deux à quatre, jamais plus. */
export const grille = items => `<div class="ent-grille">${items.map(i => `
  <div class="ent-stat${i.ton ? ` ${i.ton}` : ''}">
    <b>${e(i.v)}</b><span>${e(i.k)}</span>${i.sub ? `<em>${e(i.sub)}</em>` : ''}
  </div>`).join('')}</div>`;

/** Une liste étiquette → valeur, pour ce qui ne mérite pas un gros chiffre. */
export const liste = items => `<div class="ent-liste">${items.map(i => `
  <div><span>${e(i.k)}</span><b class="${i.ton || ''}">${e(i.v)}</b></div>`).join('')}</div>`;

/**
 * Un tableau de carton : la première colonne est du texte (un nom), les
 * autres des chiffres, et la dernière porte l'or — c'est la colonne vedette,
 * comme partout ailleurs dans le jeu.
 */
export const tableau = (cols, lignes) => `<div class="ent-table"><table>
  <thead><tr>${cols.map((c, i) => `<th class="${i === 0 ? 'left' : ''}${i === cols.length - 1 ? ' heros' : ''}">${e(c)}</th>`).join('')}</tr></thead>
  <tbody>${lignes.map(l => `<tr>${l.map((v, i) => `<td class="${i === 0 ? 'left' : ''}${i === l.length - 1 ? ' heros' : ''}">${e(v)}</td>`).join('')}</tr>`).join('')}</tbody>
</table></div>`;

/** Une carte : un kicker, un titre, un corps. */
export const carte = (kicker, titre, corps) => ({ kicker, titre, corps });

/**
 * LE DECK. Une piste qui se balaie, une carte par écran sur téléphone, et
 * des points dessous. `brancherEntractes` fait le reste (voir plus bas) :
 * sans JavaScript, ça reste une rangée qui défile — donc ça marche quand
 * même.
 */
export function deck(cartes, { cle = 'deck' } = {}) {
  const vues = cartes.filter(Boolean);
  if (!vues.length) return '';
  return `<div class="entracte" data-deck="${e(cle)}">
    <div class="ent-piste" tabindex="0" role="group" aria-label="Cartons de statistiques, balaie pour les suivants">
      ${vues.map((c, i) => `<article class="ent-carte" data-i="${i}" aria-label="${e(c.titre)}">
        <header class="ent-tete"><span class="ent-kicker">${e(c.kicker)}</span><h4>${e(c.titre)}</h4></header>
        <div class="ent-corps">${c.corps}</div>
      </article>`).join('')}
    </div>
    <div class="ent-points">${vues.map((c, i) => `<button type="button" class="${i ? '' : 'on'}" data-va="${i}" aria-label="${e(c.titre)}"></button>`).join('')}</div>
  </div>`;
}

/**
 * Les points suivent le doigt, et un clic sur un point amène sa carte. Un
 * seul écouteur par deck, posé sur la piste : le contenu se refait souvent
 * (chaque journée, chaque onglet), les decks sont donc rebranchés après
 * chaque rendu — d'où le drapeau qui évite de brancher deux fois.
 */
export function brancherEntractes(racine = document) {
  racine.querySelectorAll('.entracte').forEach(d => {
    const piste = d.querySelector('.ent-piste');
    const points = [...d.querySelectorAll('.ent-points button')];
    const cartes = [...d.querySelectorAll('.ent-carte')];
    if (!piste || !points.length) return;
    const courant = () => Math.min(cartes.length - 1, Math.max(0, Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth))));
    /*
     * LA PISTE PREND LA HAUTEUR DU CARTON QU'ON REGARDE. Les cartons n'ont
     * pas la même taille — neuf tranches de dix matchs contre trois étoiles
     * — et à hauteur commune, les courts traînaient un grand vide. La piste
     * suit donc le carton courant. Une mesure à zéro veut dire « volet
     * caché » : on ne touche à rien, et le prochain appel s'en chargera.
     */
    const ajuster = () => {
      const c = cartes[courant()];
      if (c && c.offsetHeight) piste.style.height = `${c.offsetHeight}px`;
      points.forEach((b, k) => b.classList.toggle('on', k === courant()));
    };
    d._ajuster = ajuster;
    ajuster();
    if (d.dataset.branche) return;
    d.dataset.branche = '1';
    piste.addEventListener('scroll', () => {
      clearTimeout(d._t);
      d._t = setTimeout(ajuster, 60);
    }, { passive: true });
    points.forEach((b, i) => {
      b.onclick = () => {
        piste.scrollTo({ left: i * piste.clientWidth, behavior: 'smooth' });
        points.forEach((x, k) => x.classList.toggle('on', k === i));
        setTimeout(ajuster, 260);
      };
    });
    window.addEventListener('resize', () => { clearTimeout(d._r); d._r = setTimeout(ajuster, 120); });
  });
}

/* ---------- ce qu'on met dans les cartons ---------- */

const joueursDe = t => [...SLOTS.map(s => t.roster[s.i]), t.rappelG].filter(Boolean);
const nomCourt = n => {
  const bouts = String(n || '').split(' ');
  return bouts.length > 1 ? `${bouts[0][0]}. ${bouts.slice(1).join(' ')}` : n;
};

/** Le rang d'une équipe dans la ligue sur une colonne (1 = la meilleure). */
const rangSur = (teams, t, valeur, basMieux = false) => {
  const range = teams.slice().sort((a, b) => (basMieux ? valeur(a) - valeur(b) : valeur(b) - valeur(a)));
  return range.indexOf(t) + 1;
};

/**
 * LES CARTONS DE LA SAISON. Tout sort des compteurs du moteur : la fiche et
 * le classement, les tirs et la finition, le travail des gardiens, l'arc de
 * la saison par tranches de dix matchs, les soirs marquants, l'infirmerie.
 */
export function cartesDeSaison({ you, teams, rang, ctx }) {
  const J = you.journal || [];
  if (!J.length) return [];
  const n = teams.length;
  const pj = you.W + you.L + you.OTL;
  const js = joueursDe(you);
  const pat = js.filter(p => p.p !== 'G' && p.simGP).sort((a, b) => b.simPTS - a.simPTS || b.simG - a.simG);
  const gar = js.filter(p => p.p === 'G' && p.simGP).sort((a, b) => b.simGP - a.simGP);
  const tirs = pat.reduce((s, p) => s + (p.simSH || 0), 0);
  const tirsContre = gar.reduce((s, p) => s + (p.simSA || 0), 0);
  const arrets = gar.reduce((s, p) => s + (p.simSV || 0), 0);
  const pun = pat.reduce((s, p) => s + (p.simPIM || 0), 0);
  const butsAN = js.reduce((s, p) => s + (p.simPPG || 0), 0);
  const diff = you.GF - you.GA;

  /* 1. LA SAISON — la fiche, le rang, et ce que la ligue en dit. */
  const rangBP = rangSur(teams, you, t => t.GF);
  const rangBC = rangSur(teams, you, t => t.GA, true);
  const rangDiff = rangSur(teams, you, t => t.GF - t.GA);
  const c1 = carte('Saison régulière', 'La fiche',
    grille([
      { k: 'Fiche', v: `${you.W}-${you.L}-${you.OTL}` },
      { k: 'Points', v: you.PTS },
      { k: 'Rang', v: `${rangCourt(rang)} / ${n}`, ton: rang === 1 ? 'or' : '' },
      { k: 'Différentiel', v: signe(diff), ton: diff > 0 ? 'bon' : diff < 0 ? 'mauvais' : '' },
    ])
    + liste([
      { k: 'Buts pour', v: `${you.GF} · ${rangCourt(rangBP)} de la ligue` },
      { k: 'Buts contre', v: `${you.GA} · ${rangCourt(rangBC)} de la ligue` },
      { k: 'Différentiel', v: `${signe(diff)} · ${rangCourt(rangDiff)} de la ligue` },
      { k: 'Points par match', v: un(you.PTS / Math.max(1, pj), 2) },
    ]));

  /* 2. L'ATTAQUE — le volume, la finition, l'avantage numérique, les meneurs. */
  const c2 = carte('Offensive', 'L\'attaque',
    grille([
      { k: 'Buts / match', v: un(you.GF / Math.max(1, pj), 2) },
      { k: 'Tirs / match', v: un(tirs / Math.max(1, pj)) },
      { k: '% de tir', v: `${un(100 * you.GF / Math.max(1, tirs))} %` },
      { k: 'Buts en AN', v: butsAN },
    ])
    + tableau(['Meneurs', 'B', 'A', 'PTS'], pat.slice(0, 5).map(p => [nomCourt(p.n), p.simG, p.simA, p.simPTS])));

  /* 3. LA DÉFENSIVE — ce qu'on concède, et qui étouffe. */
  const pm = pat.slice().sort((a, b) => b.simPM - a.simPM).slice(0, 5);
  const c3 = carte('Défensive', 'Sans la rondelle',
    grille([
      { k: 'Buts alloués / m.', v: un(you.GA / Math.max(1, pj), 2) },
      { k: 'Tirs concédés / m.', v: un(tirsContre / Math.max(1, pj)) },
      { k: '% d\'arrêts', v: pct3(arrets / Math.max(1, tirsContre)) },
      { k: 'Punitions / match', v: un(pun / Math.max(1, pj)) },
    ])
    + tableau(['Différentiel', 'PJ', 'PTS', '+/-'], pm.map(p => [nomCourt(p.n), p.simGP, p.simPTS, signe(p.simPM || 0)])));

  /* 4. LES GARDIENS — la ligne de chacun, comme au dos d'une carte. */
  const c4 = gar.length ? carte('Devant le filet', 'Les gardiens',
    tableau(['Gardien', 'PJ', 'V-D', '%ARR', 'MBA'], gar.map(g => [
      nomCourt(g.n), g.simGP, `${g.simW || 0}-${(g.simGP || 0) - (g.simW || 0)}`,
      pct3((g.simSV || 0) / Math.max(1, g.simSA || 1)), un((g.simGA || 0) / Math.max(1, g.simGP), 2),
    ]))
    + liste([
      { k: 'Blanchissages', v: gar.reduce((s, g) => s + (g.simSO || 0), 0) },
      { k: 'Arrêts', v: arrets },
      { k: 'Tirs vus', v: tirsContre },
    ])) : null;

  /* 5. L'ARC DE LA SAISON — dix matchs à la fois, comme un relevé de compte. */
  const tranches = [];
  for (let i = 0; i < J.length; i += 10) {
    const bloc = J.slice(i, i + 10);
    const v = bloc.filter(m => m.win).length;
    const dp = bloc.filter(m => !m.win && m.ot).length;
    const bp = bloc.reduce((s, m) => s + m.gf, 0), bc = bloc.reduce((s, m) => s + m.ga, 0);
    tranches.push([`${i + 1}-${i + bloc.length}`, `${v}-${bloc.length - v - dp}-${dp}`, `${bp}-${bc}`, signe(bp - bc)]);
  }
  let cur = 0, best = 0, curP = 0, pire = 0;
  for (const m of J) {
    if (m.win) { cur++; curP = 0; best = Math.max(best, cur); }
    else { curP++; cur = 0; pire = Math.max(pire, curP); }
  }
  const ot = J.filter(m => m.ot).length;
  const c5 = carte('Le fil de l\'année', 'Par tranches de dix',
    tableau(['Matchs', 'V-D-DP', 'BP-BC', 'Diff'], tranches)
    + liste([
      { k: 'Plus longue séquence', v: `${best} victoire${best > 1 ? 's' : ''}` },
      { k: 'Plus long creux', v: `${pire} défaite${pire > 1 ? 's' : ''}` },
      { k: 'Prolongations', v: `${ot} match${ot > 1 ? 's' : ''} · ${J.filter(m => m.ot && m.win).length} gagné${J.filter(m => m.ot && m.win).length > 1 ? 's' : ''}` },
    ]));

  /* 6. LES SOIRS — le meilleur, le pire, et les chiffres qui les encadrent. */
  const plusBelle = J.reduce((a, m) => (!a || m.gf - m.ga > a.gf - a.ga ? m : a), null);
  const pireSoir = J.reduce((a, m) => (!a || m.ga - m.gf > a.ga - a.gf ? m : a), null);
  const nom = t => (ctx && ctx.teamShort ? ctx.teamShort(t) : (t && t.name) || '');
  const c6 = carte('Les soirs', 'À retenir',
    liste([
      plusBelle ? { k: `Plus belle soirée · match ${plusBelle.n}`, v: `${plusBelle.gf}-${plusBelle.ga} c. ${nom(plusBelle.adv)}`, ton: 'bon' } : null,
      pireSoir ? { k: `Soir à oublier · match ${pireSoir.n}`, v: `${pireSoir.ga}-${pireSoir.gf} c. ${nom(pireSoir.adv)}`, ton: 'mauvais' } : null,
    ].filter(Boolean))
    + grille([
      { k: 'Blanchissages', v: J.filter(m => m.ga === 0).length },
      { k: 'Matchs à 1 but', v: J.filter(m => Math.abs(m.gf - m.ga) === 1).length },
      { k: 'Soirs à 5 buts +', v: J.filter(m => m.gf >= 5).length },
      { k: 'Buts en 3 périodes', v: `${Math.max(...J.map(m => m.gf))} max` },
    ]));

  /* 7. L'INFIRMERIE — ce que la saison a coûté. */
  const bless = (you.injuriesLog || []).slice().sort((a, b) => b.games - a.games);
  const c7 = carte('Santé', 'L\'infirmerie',
    grille([
      { k: 'Blessures', v: bless.length },
      { k: 'Matchs ratés', v: bless.reduce((s, b) => s + b.games, 0) },
      { k: 'Alignement complet', v: `${J.length - new Set(bless.map(b => b.at)).size} soirs` },
    ])
    + (bless.length
      ? tableau(['Absences', 'À partir du', 'Matchs'], bless.slice(0, 5).map(b => [nomCourt(b.player.n), `match ${b.at}`, b.games]))
      : '<div class="ent-vide">Pas une seule blessure de toute la saison. Ça n\'arrive à peu près jamais.</div>'));

  return [c1, c2, c3, c4, c5, c6, c7].filter(Boolean);
}

/**
 * LES TROIS ÉTOILES D'UN MATCH, comme à la fin d'une diffusion. La règle est
 * écrite ici plutôt que devinée : un patineur vaut 3 par but et 2 par passe ;
 * un gardien vaut ce qu'il a volé — ses arrêts au-dessus de 90 %, une prime
 * s'il gagne, une autre s'il blanchit. Un blanchissage de 30 arrêts vaut donc
 * autant qu'un tour du chapeau, ce qui est à peu près le consensus.
 */
export function troisEtoiles(f, A, B) {
  const score = new Map();
  const pose = (p, t, pts, ligne) => {
    if (!p) return;
    const x = score.get(p) || { p, t, pts: 0, ligne: '' };
    x.pts += pts; x.ligne = ligne || x.ligne;
    score.set(p, x);
  };
  const compte = new Map();
  for (const b of f.buts) {
    const t = b.cote === 'A' ? A : B;
    const c = p => { const v = compte.get(p) || { g: 0, a: 0 }; compte.set(p, v); return v; };
    if (b.marqueur) c(b.marqueur).g++;
    for (const p of b.passeurs || []) c(p).a++;
    if (b.marqueur) pose(b.marqueur, t, 3, '');
    for (const p of b.passeurs || []) pose(p, t, 2, '');
  }
  for (const [p, c] of compte) {
    const x = score.get(p);
    if (x) x.ligne = `${c.g} B, ${c.a} A`;
  }
  for (const cote of ['A', 'B']) {
    const g = cote === 'A' ? f.gardienA : f.gardienB;
    if (!g) continue;
    const alloues = f.buts.filter(b => b.cote !== cote && b.gardien === g).length;
    const arr = f.arrets[cote] || 0;
    const vus = arr + alloues;
    if (!vus) continue;
    const gagne = f.vainqueur === cote;
    const pts = (arr - 0.9 * vus) * 1.5 + (gagne ? 1.5 : 0) + (alloues ? 0 : 2);
    pose(g, cote === 'A' ? A : B, pts, `${arr} arrêts sur ${vus}`);
  }
  return [...score.values()].sort((a, b) => b.pts - a.pts).slice(0, 3);
}

/**
 * LES CARTONS D'UN MATCH : les trois étoiles, puis les chiffres du soir —
 * tirs par période, avantage numérique, punitions, gardiens. Le sommaire
 * but par but reste dessous ; ces cartons répondent à « qui a décidé ça ? »
 * avant qu'on ait à lire la feuille.
 */
export function cartesDeMatch({ f, A, B, ctx }) {
  const tirs = c => f.tirs[c].reduce((a, b) => a + b, 0);
  const tA = tirs('A'), tB = tirs('B');
  const nom = t => (ctx && ctx.teamShort ? ctx.teamShort(t) : (t && t.name) || '');
  const etoiles = troisEtoiles(f, A, B);
  const c1 = etoiles.length ? carte('Les trois étoiles', 'Qui a décidé le match',
    `<div class="ent-etoiles">${etoiles.map((x, i) => `
      <div class="ent-etoile">
        <span class="ent-rang">${'★'.repeat(i + 1)}</span>
        <span class="ent-nom">${e(x.p.n)}</span>
        <span class="ent-eq">${e(nom(x.t))}</span>
        <span class="ent-ligne">${e(x.ligne)}</span>
      </div>`).join('')}</div>`) : null;

  const an = c => (f.punitions || []).filter(p => p.cote !== c);
  const butsAN = c => f.buts.filter(b => b.cote === c && b.an).length;
  const c2 = carte('Le tableau', 'Les chiffres du match',
    tableau(['', nom(A), nom(B)], [
      ['Buts', f.gfA, f.gfB],
      ['Tirs', tA, tB],
      ['1re période', f.tirs.A[1], f.tirs.B[1]],
      ['2e période', f.tirs.A[2], f.tirs.B[2]],
      ['3e période', f.tirs.A[3], f.tirs.B[3]],
      ['Avantages', an('A').length, an('B').length],
      ['Buts en AN', butsAN('A'), butsAN('B')],
      ['Arrêts', f.arrets.A || 0, f.arrets.B || 0],
    ]));
  return [c1, c2].filter(Boolean);
}
