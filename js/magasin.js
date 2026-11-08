/**
 * LA BOUTIQUE À SES NŒUDS (V27, tranche 3 ; docs/refonte-v27-3.md, la maquette 5 de docs/maquettes/v27.html).
 *
 * Une émission de télé, pas un catalogue : la bande du marché (le nœud, tes jetons, tes quatre achats en pastilles), la
 * pièce de banc parmi trois — de vraies cartes de jeu (`carteHtml`), une seule à prendre —, puis les packs ouverts,
 * chacun son métal et son prix du moment, et « Fermer · prochaine dans N ». Hors d'un nœud, la boutique est fermée et dit
 * quand elle rouvre. Le toucher d'un pack ouvre sa fiche : toutes ses chances (« 1 pack sur N »), le JOUEUR d'une carte
 * (son niveau, S80 : les taux et ce que chaque niveau veut dire en rang réel) et sa FINITION (le barème des variantes),
 * ce qu'on choisit (la franchise, la saison — ou le hasard), la garantie, et « Acheter ». L'achat est une décision
 * (js/game.js) ; l'ouverture, le paquet qui se déchire (js/gerant.js).
 */
import { PACKS_TOUS, NUMEROS, PITIE, chancesDe, cotesDuPack, cartesDuPack, niveauxDuPack, prixDe, tierDuPack, POSTES_DU_PACK, BOUTIQUE } from './packs.js';
import { NIVEAUX, ETOILE, nomDuNiveau } from './niveaux.js';
import { NOM_VARIANTE } from './rarete.js';
import { esc, money as M } from './util.js';
import { pochetteHtml, carteHtml } from './cartes.js';
import { COACHS } from './coachs.js';
import { RAYONS_CLUB } from './club.js';
import { carteLigne, grille } from './composants.js';

const $ = id => document.getElementById(id);

/*
 * ctx : { jetons, ouverts (cle → true | 'raison du verrou'), mods (patrons : rabais, holo, carteExtra, sansBase), sansHolo,
 *         noeud { k, faits, max, dernier, hausse } (null : fermée), prochain { k, dans } (null : la dernière est passée),
 *         pieces [{ cle, niv, A, lignes }], piecePrise, prixPiece, part (qui sort de ta main pleine), prendrePiece(cle),
 *         franchises [{ cle, nom }], coachs [{ cle, nom }], coachRun, decennies [1970…], roles [{ cle, nom }],
 *         verrousChoix { choix: { valeur: raison } } (Jalon P2), scelles [{ palier, cle, verrou }], ouvrirScelle(palier),
 *         acheter(cle, { prix, params, scelle }), club, clubPorte, acheterClub(cle, prix), onFerme() }
 */
/* Un pourcentage à une décimale au plus, à la québécoise : « 4,4 % », « 36 % ». */
const pct = x => `${(Math.round(x * 10) / 10).toString().replace('.', ',')} %`;
/*
 * LE JOUEUR D'UNE CARTE (S80) : ses chances par niveau, et ce que chaque
 * niveau veut dire dans sa vraie saison — un RANG, jamais une cote. Rien pour
 * un pack qui ne tire pas de niveau (un talent, un trio).
 */
function niveauxHtml(cle, mods = {}) {
  const nv = niveauxDuPack(cle, mods);
  if (!nv) return '';
  const lignes = NIVEAUX.map((N, k) => ({ N, k, v: nv[N.cle] })).filter(x => x.v > 0);
  // Pourquoi un niveau peut manquer : le plafond, partout ; et pour un pack d'équipe, un club qui n'a jamais eu de Phénomène.
  const manque = PACKS_TOUS[cle].famille === 'equipe' ? 'sous ton plafond, ou dans ce club' : 'sous ton plafond';
  return `<h4>Le joueur d'une carte</h4>
      <table class="pk-bareme pk-niveaux">${lignes.map(({ N, k, v }) => `<tr><th>${k >= ETOILE ? '★ ' : ''}${esc(N.nom)}</th><td class="pk-rang">${esc(N.rang)}</td><td>${pct(v)}</td></tr>`).join('')}</table>
      <p class="pk-num">Son rang dans sa vraie saison, à son poste. Sans ce niveau ${manque} : le plus proche.</p>
      ${mods.prestige ? `<p class="pk-num">📈 ${esc(mods.prestige.nom)} : ton prestige ajoute des Étoiles et des Phénomènes, run après run.${mods.coach && COACHS[mods.coach] ? ` ${COACHS[mods.coach].ico} Le dépisteur ${esc(COACHS[mods.coach].de)} penche pour les joueurs de sa couleur.` : ''}</p>` : ''}`;
}
/* « 41e », « 1er ». */
const e = n => `${n}<sup>${n === 1 ? 'er' : 'e'}</sup>`;
export function ouvrirMagasin(ctx) {
  // Dans une page du Marché (`ctx.dans`, `ctx.fermer`, js/game.js) ou dans sa fenêtre.
  const m = ctx.dans || $('magasinModal');
  if (!m) return;
  const N = ctx.noeud;
  // LE PRIX DU MOMENT : la hausse des achats de CE nœud (js/actes.js), les patrons ; il repart de zéro au nœud suivant.
  const rabaisDe = () => (ctx.mods.rabais || 1) * (N ? N.hausse : 1);
  const plein = !N || N.faits >= N.max;
  let choisie = ctx.pieces && ctx.pieces.length ? ctx.pieces[0].cle : null;
  let ongletClub = 'club', clubOuvert = false;
  // Un pack se lit à son métal (`pk-bronze`…) et à son prix ; impayable ou au bout des quatre achats, il se grise.
  const tuile = cle => {
    const P = PACKS_TOUS[cle];
    const prix = prixDe(cle, rabaisDe());
    const tier = P.sorte === 'cartes' ? 'cartes' : tierDuPack(cle, ctx.mods);
    const non = plein ? 'Quatre achats à ce nœud' : ctx.jetons < prix ? `Il te manque ${prix - ctx.jetons} 🪙` : '';
    return `<button type="button" class="pk-tuile mk-pack pk-${tier}${non ? ' pk-cher' : ''}" data-pack="${esc(cle)}"${non ? ` title="${esc(non)}"` : ''}>
      <span class="mk-pack-nom">${esc(P.nom.replace(/^Pack\s+/i, ''))}</span><span class="pk-prix">${prix}</span></button>`;
  };
  /*
   * TON CLUB (1.0, oct.) : les clubs et les couleurs, en jetons — hors des quatre achats. Une rangée de quatre (le club que tu
   * portes, les deux premiers à débloquer, « Et N › ») ; « Et N › » ouvre le rayon entier, ses deux onglets et le nuancier.
   */
  const clubRangee = () => {
    const clubs = ctx.club.filter(o => o.sorte === 'club' && !o.verrou).slice(0, 2);
    const tuileClub = (visuel, nom, mot, cls = '', data = '') => `<button type="button" class="pk-club-mini${cls}"${data}><span class="pk-club-mini-ecu" aria-hidden="true">${visuel}</span><b>${esc(nom)}</b><small>${esc(mot)}</small></button>`;
    return `<section class="mk-section pk-rayon-club-rangee"><span class="mk-l"><span>Ton club</span><b>${ctx.club.length} à débloquer</b></span><div class="pk-club-rangee">
      ${ctx.clubPorte ? tuileClub(ctx.clubPorte.apercu, ctx.clubPorte.nom, 'Porté', ' porte', ' data-club-tout="1"') : ''}
      ${clubs.map(o => tuileClub(o.apercu, o.nom, `${o.prix} 🪙`, '', ` data-club="${esc(o.cle)}"`)).join('')}
      ${tuileClub('›', `Et ${Math.max(0, ctx.club.length - clubs.length)}`, 'Voir', ' pk-club-plus', ' data-club-tout="1"')}
    </div></section>`;
  };
  const club = () => {
    const offres = ctx.club.filter(o => o.sorte === ongletClub);
    return `<section class="pk-rayon pk-rayon-club"><h3>Ton club · ${ctx.club.length} à débloquer</h3>
      <div class="stat-tabs" role="tablist">${RAYONS_CLUB.map(R => `<button type="button" role="tab" class="stat-tab${R.cle === ongletClub ? ' on' : ''}" aria-selected="${R.cle === ongletClub}" data-onglet="${R.cle}">${esc(R.titre)} · ${ctx.club.filter(o => o.sorte === R.cle).length}</button>`).join('')}</div>
      <div class="pk-rangee${ongletClub === 'palette' ? ' pk-nuancier' : ''}">${offres.map(o => {
      const manque = !o.verrou && ctx.jetons < o.prix ? o.prix - ctx.jetons : 0;
      const visuel = o.nuance ? `<span class="pk-nuance" aria-hidden="true" style="--n1:${o.nuance[0]};--n2:${o.nuance[1]}"></span>` : `<span class="pk-club-ecu" aria-hidden="true">${o.apercu}</span>`;
      return `<button type="button" class="pk-tuile pk-club${o.verrou ? ' verrou' : ''}${manque ? ' pk-cher' : ''}" data-club="${esc(o.cle)}"${o.verrou ? ` title="${esc(o.verrou)}"` : manque ? ` title="Il te manque ${manque} 🪙"` : ''}>
        ${visuel}
        <span class="pk-nom">${esc(o.nom)}</span>
        <span class="pk-prix">${o.verrou ? '🔒' : `${o.prix} 🪙`}</span>
      </button>`;
    }).join('') || '<p class="pk-mot">Tout est à toi.</p>'}</div></section>`;
  };
  const dessiner = () => {
    const scellesHtml = (ctx.scelles || []).length ? `<section class="pk-rayon pk-rayon-scelles"><h3>📦 Déjà à toi · ${ctx.scelles.length} à ouvrir</h3><div class="pk-rangee">${ctx.scelles.map(x => {
      const P = PACKS_TOUS[x.cle];
      return `<button type="button" class="pk-tuile pk-${P.sorte === 'cartes' ? 'cartes' : P.tier}${x.verrou ? ' verrou' : ''}" data-scelle="${esc(x.palier)}"${x.verrou ? ` title="${esc(x.verrou)}"` : ''}>
        ${pochetteHtml({ etat: 'scellee', ico: P.ico, mot: 'Scellé' })}
        <span class="pk-nom">${esc(P.nom)}</span>
        <span class="pk-prix">${x.verrou ? `🔒 ${esc(x.verrou)}` : 'Ouvrir'}</span>
      </button>`;
    }).join('')}</div></section>` : '';
    const signe = ctx.plafond ? `<small class="mk-signe">Tu signes jusqu'à ${M(Math.max(0, ctx.plafond.salaireMax))}</small>` : '';
    const caisse = `<span class="mk-caisse"><b>${ctx.jetons}</b> jetons</span>`;
    let corps;
    if (!N) {
      // FERMÉE : quand elle rouvre, en matchs ; après le dernier nœud, les séries se jouent sans elle.
      corps = `<header class="mk-bande ferme"><span class="mk-k"><b>Boutique</b><span>Fermée</span></span>
          <div class="mk-tete"><span class="mk-titre">${ctx.prochain ? `Dans ${ctx.prochain.dans} match${ctx.prochain.dans > 1 ? 's' : ''}` : 'Les séries'}</span>${caisse}</div></header>
        <p class="pk-mot">🔒 ${ctx.prochain ? `Elle rouvre après ton ${e(ctx.prochain.k)} match, au prix de base.` : 'La dernière boutique est passée : tes jetons ne servent plus.'}</p>
        ${scellesHtml}`;
    } else {
      const P = ctx.pieces || [];
      const pieces = P.length ? `<section class="mk-section"><span class="mk-l"><span>Une pièce de banc</span><b>${ctx.piecePrise ? 'Prise' : '1 seule'}</b></span>
          ${grille(P.map(x => carteLigne(carteHtml({ cle: x.cle, niveau: x.niv - 1, genreCarte: 'tactique', ico: x.A.ico, nomHtml: esc(x.A.nom), typeHtml: esc(`${nomDuNiveau(x.niv - 1)} · ${x.A.style}`), lecture: true }),
            x.lignes[0] ? (x.lignes[0].bon === false ? esc(x.lignes[0].txt) : `<b>${esc(x.lignes[0].txt)}</b>`) : '',
            { cls: `pl-carte-touche${x.cle === choisie && !ctx.piecePrise ? ' choisie' : ''}${ctx.piecePrise ? ' pl-carte-eteinte' : ''}`, attrs: ` data-piece="${esc(x.cle)}" role="button" tabindex="0" title="${esc(x.lignes.map(l => l.txt).join(' · '))}"` })))}
          ${ctx.piecePrise ? '' : `<button type="button" class="btn gold mk-prendre"${plein || ctx.jetons < ctx.prixPiece ? ' disabled' : ''}>${plein ? 'Quatre achats faits' : ctx.jetons < ctx.prixPiece ? `Il te manque ${ctx.prixPiece - ctx.jetons} 🪙` : `Prendre · ${ctx.prixPiece}`}</button>`}
          ${ctx.part && !ctx.piecePrise ? `<p class="pk-num">Ta main est pleine : ${esc(ctx.part)} part.</p>` : ''}</section>` : '';
      const packs = BOUTIQUE.filter(k => ctx.ouverts[k] === true && PACKS_TOUS[k]);
      corps = `<header class="mk-bande${N.dernier ? ' dernier' : ''}"><span class="mk-k"><b>${N.dernier ? 'Dernière boutique' : 'Boutique'}</b><span>${N.k ? `Après le ${e(N.k)}` : 'Avant le 1<sup>er</sup> match'}</span></span>
          <div class="mk-tete"><span class="mk-titre">Le marché</span>${caisse}</div>
          <span class="mk-pips" role="img" aria-label="${N.faits} achat${N.faits > 1 ? 's' : ''} sur ${N.max}">${Array.from({ length: N.max }, (_, i) => `<i${i < N.faits ? ' class="on"' : ''}></i>`).join('')}</span>${signe}</header>
        ${N.dernier ? '<p class="pk-mot">Après elle, les séries : les jetons qui restent sont perdus.</p>' : ''}
        ${pieces}
        <section class="mk-section"><span class="mk-l"><span>Les packs</span></span><div class="mk-rangee">${packs.map(tuile).join('')}</div></section>
        ${(ctx.club || []).length ? (clubOuvert ? club() : clubRangee()) : ''}
        ${scellesHtml}`;
    }
    m.innerHTML = `<div class="choix-sheet pk-sheet" role="dialog" aria-modal="true" aria-label="La boutique">
      <div class="choix-corps pk-corps">${corps}
        <button type="button" class="btn mk-fermer choix-fermer">Fermer${N ? ` · ${ctx.prochain ? `prochaine dans ${ctx.prochain.dans}` : 'dernière boutique'}` : ''}</button>
      </div>
    </div>`;
    m.querySelector('.choix-fermer').onclick = () => fermer();
    m.querySelectorAll('[data-pack]').forEach(b => { b.onclick = () => fiche(b.dataset.pack); });
    m.querySelectorAll('[data-piece]').forEach(b => {
      const choisir = () => { if (ctx.piecePrise) return; choisie = b.dataset.piece; dessiner(); m.querySelector(`[data-piece="${choisie}"]`)?.focus(); };
      b.onclick = choisir;
      b.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choisir(); } };
    });
    const prendre = m.querySelector('.mk-prendre');
    if (prendre) prendre.onclick = () => { if (prendre.disabled || !choisie) return; fermer(true); ctx.prendrePiece(choisie); };
    m.querySelectorAll('[data-scelle]').forEach(b => { b.onclick = () => { if (b.classList.contains('verrou')) return; fermer(true); ctx.ouvrirScelle(b.dataset.scelle); }; });
    m.querySelectorAll('[data-club]').forEach(b => { b.onclick = () => ficheClub(ctx.club.find(o => o.cle === b.dataset.club)); });
    m.querySelectorAll('[data-onglet]').forEach(b => { b.onclick = () => {
      const c = m.querySelector('.pk-corps'), haut = c ? c.scrollTop : 0;
      ongletClub = b.dataset.onglet; dessiner();
      const c2 = m.querySelector('.pk-corps'); if (c2) c2.scrollTop = haut;
    }; });
    m.querySelectorAll('[data-club-tout]').forEach(b => { b.onclick = () => { clubOuvert = true; dessiner(); m.querySelector('.pk-rayon-club')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
  };
  const fiche = cle => {
    const P = PACKS_TOUS[cle];
    const verrou = ctx.ouverts[cle] === true ? '' : (ctx.ouverts[cle] || 'Verrouillé');
    const prix = prixDe(cle, rabaisDe());
    const ch = chancesDe(cle, P.sorte === 'joueurs' ? ctx.mods : {});
    const cotes = cotesDuPack(cle, ctx.mods);
    const tot = Object.values(cotes).reduce((a, b) => a + b, 0) || 100;
    const noms = { ...NOM_VARIANTE, legendaire: 'Holo numérotée' };
    // Jalon P2 : la décennie et le rôle ; une option que les déblocages ferment se voit, grisée, avec sa raison.
    const verrous = (ctx.verrousChoix || {})[P.choix] || {};
    const option = (cle, nom) => `<option value="${esc(cle)}"${verrous[cle] ? ` disabled title="${esc(verrous[cle])}"` : ''}>${esc(nom)}${verrous[cle] ? ' 🔒' : ''}</option>`;
    const choix = P.choix === 'decennie' && ctx.decennies
      ? `<label class="pk-choix">La décennie <select id="pkParam"><option value="">🎲 Au hasard</option>${ctx.decennies.map(d => option(d, `Les années ${String(d).slice(2)}`)).join('')}</select></label>`
      : P.choix === 'skill' && ctx.roles
        ? `<label class="pk-choix">Le rôle <select id="pkParam"><option value="">🎲 Au hasard</option>${ctx.roles.map(r => option(r.cle, r.nom)).join('')}</select></label>`
        : P.choix === 'franchise'
          ? `<label class="pk-choix">La franchise <select id="pkParam"><option value="">🎲 Au hasard</option>${ctx.franchises.map(f => `<option value="${esc(f.cle)}">${esc(f.nom)}</option>`).join('')}</select></label>`
          : P.choix === 'coach' && ctx.coachs
          ? `<label class="pk-choix">Le coach <select id="pkParam"><option value="">🎲 Au hasard</option>${ctx.coachs.map(c => `<option value="${esc(c.cle)}"${c.cle === ctx.coachRun ? ' selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>` : '';
    // Nov. 2026 : le poste que vise le pack (`P.poste`, le Pack Époque).
    const poste = P.poste ? `<label class="pk-choix">Le poste <select id="pkPoste"><option value="">🎲 Au hasard</option>${Object.entries(POSTES_DU_PACK).map(([k, nom]) => `<option value="${k}">${esc(nom)}</option>`).join('')}</select></label>` : '';
    const peut = !verrou && !plein && ctx.jetons >= prix;
    const d = document.createElement('div');
    d.className = 'pk-fiche';
    d.innerHTML = `<div class="pk-fiche-carte pk-${P.sorte === 'cartes' ? 'cartes' : tierDuPack(cle, ctx.mods)}">
      <div class="pk-fiche-tete"><span class="pk-ico">${P.ico}</span><div><div class="pk-fiche-nom">${esc(P.nom)}</div><div class="pk-fiche-sous">${(nc => `${nc} carte${nc > 1 ? 's' : ''}`)(cartesDuPack(cle, P.sorte === 'joueurs' ? ctx.mods : {}))} · ${prix} 🪙</div></div></div>
      <p class="pk-fiche-texte">${esc(P.texte)}</p>
      <div class="pk-detail"><h4>Les chances</h4>
      <table class="pk-chances">${ch.map(x => `<tr${x.maudite ? ' class="pk-maudite"' : x.niveau ? ' class="pk-niveau"' : ''}><th>${esc(x.nom)}</th><td>${esc(x.txt)}</td></tr>`).join('')}</table>
      ${P.sorte === 'joueurs' && ctx.plafond ? `<p class="pk-num">💵 Tu signes jusqu'à ${M(Math.max(0, ctx.plafond.salaireMax))} (ton espace, plus le plus gros contrat qu'une sortie libérerait) ; au-delà, la carte se montre, grisée.</p>` : ''}
      ${P.sorte === 'joueurs' ? niveauxHtml(cle, ctx.mods) : ''}
      ${P.sorte === 'joueurs' ? `<p class="pk-num pk-garantie">🛟 Une Or ou une Holo au plus tard au ${PITIE + 1}e pack de joueurs${ctx.sansHolo ? ` (tu en es à ${ctx.sansHolo} sans)` : ''}.</p>` : ''}
      <h4>${P.sorte === 'joueurs' ? 'L\'édition d\'une carte' : 'Le barème d\'une carte'}</h4>
      <table class="pk-bareme">${Object.entries(cotes).map(([k, v]) => `<tr><th>${esc(noms[k] || k)}</th><td>${(Math.round((v / tot) * 1000) / 10).toString().replace('.', ',')} %</td></tr>`).join('')}</table>
      ${P.sorte === 'joueurs' ? `<p class="pk-num">Une Holo est numérotée : ${NUMEROS.map(([n, w]) => `${esc(n)} ${w} %`).join(' · ')}.</p>` : ''}
      </div>
      ${choix}
      ${poste}
      ${verrou ? `<p class="pk-verrou">🔒 ${esc(verrou)}</p>` : ''}
      <div class="pk-fiche-actions">
        <button type="button" class="btn pk-retour">Retour</button>
        ${peut && ctx.ouvrirScelle ? '<button type="button" class="btn pk-sceller" title="Payé tout de suite ; il t\'attend dans « Tes packs », à ouvrir quand tu veux.">Garder scellé</button>' : ''}
        <button type="button" class="btn gold pk-acheter"${peut ? '' : ' disabled'}>${verrou ? 'Verrouillé' : plein ? 'Quatre achats à ce nœud' : ctx.jetons >= prix ? `Acheter · ${prix} 🪙` : `Il te manque ${prix - ctx.jetons} 🪙`}</button>
      </div>
    </div>`;
    m.querySelector('.choix-sheet').appendChild(d);
    d.querySelector('.pk-retour').onclick = () => d.remove();
    const achat = d.querySelector('.pk-acheter');
    const payer = scelle => {
      if (!peut) return;
      const v = d.querySelector('#pkParam');
      const params = P.choix ? { [P.choix]: v && v.value ? v.value : null } : {};
      const vp = d.querySelector('#pkPoste');
      if (P.poste) params.poste = vp && vp.value ? vp.value : null;
      // La fiche part avec l'achat : dans une page, `fermer` laisse la boutique en place, et un « Acheter » resté
      // sous le doigt rachetait le même pack (oct., JP : *encore des doublons de packs achetés*).
      d.remove();
      fermer(true);
      ctx.acheter(cle, { prix, params, scelle });
    };
    if (achat) achat.onclick = () => payer(false);
    const sceller = d.querySelector('.pk-sceller');
    if (sceller) sceller.onclick = () => payer(true);
  };
  /* La fiche d'un objet du club : l'aperçu en grand, et « Acheter » si on peut. */
  const ficheClub = o => {
    if (!o) return;
    const peut = !o.verrou && ctx.jetons >= o.prix;
    const d = document.createElement('div');
    d.className = 'pk-fiche';
    d.innerHTML = `<div class="pk-fiche-carte pk-club">
      <div class="club-porte"><span class="club-ecu" aria-hidden="true">${o.apercu}</span><b>${esc(o.nom)}</b></div>
      <p class="pk-fiche-texte">${o.sorte === 'club' ? 'Son nom et son écusson, ensemble' : 'Les couleurs de ton club'} : à toi pour toutes tes parties, porté tout de suite, et changé quand tu veux aux déblocages. Ça ne change rien au jeu.</p>
      ${o.verrou ? `<p class="pk-verrou">🔒 ${esc(o.verrou)}</p>` : ''}
      <div class="pk-fiche-actions">
        <button type="button" class="btn pk-retour">Retour</button>
        <button type="button" class="btn gold pk-acheter"${peut ? '' : ' disabled'}>${o.verrou ? 'Verrouillé' : peut ? `Acheter · ${o.prix} 🪙` : `Il te manque ${o.prix - ctx.jetons} 🪙`}</button>
      </div>
    </div>`;
    m.querySelector('.choix-sheet').appendChild(d);
    d.querySelector('.pk-retour').onclick = () => d.remove();
    d.querySelector('.pk-acheter').onclick = () => { if (!peut) return; d.remove(); fermer(true); ctx.acheterClub(o.cle, o.prix); };
  };
  const fermer = (silencieux = false) => {
    // Dans une page, seul un geste de fermeture la ferme : un achat laisse la boutique en place (js/game.js, `remplirMarche`).
    if (ctx.dans) { if (ctx.fermer && !silencieux) ctx.fermer(); }
    else { m.hidden = true; m.innerHTML = ''; document.body.classList.remove('choix-ouvert'); }
    if (!silencieux && ctx.onFerme) ctx.onFerme();
  };
  if (!ctx.dans) { m.hidden = false; document.body.classList.add('choix-ouvert'); }
  dessiner();
}
