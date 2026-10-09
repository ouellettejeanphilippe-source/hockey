/**
 * LA BOUTIQUE (S79) — des rayons de packs, comme HUT, FUT ou MLB The Show.
 *
 * Chaque pack est un SACHET à son tier (bronze, argent, or, premium, ou
 * cartes), son prix, son nombre de cartes et sa meilleure chance lisible d'un
 * coup d'oeil ; le toucher ouvre sa fiche : toutes ses chances (« 1 pack sur
 * N »), le JOUEUR d'une carte (son niveau, S80 : les taux et ce que chaque
 * niveau veut dire en rang réel) et sa FINITION (le barème des variantes),
 * ce qu'on choisit (la franchise, la saison — ou le hasard), la garantie, et
 * « Acheter ». L'achat est une décision (js/game.js) ; l'ouverture, le
 * paquet qui se déchire (js/gerant.js).
 */
import { PACKS_TOUS, RAYONS, TIERS, NUMEROS, PITIE, chancesDe, cotesDuPack, cartesDuPack, niveauxDuPack, prixDe } from './packs.js';
import { NIVEAUX, ETOILE } from './niveaux.js';
import { RARETES } from './cartes.js';
import { esc, money as M } from './util.js';
import { COACHS } from './coachs.js';
import { RAYONS_CLUB } from './club.js';

const $ = id => document.getElementById(id);

/*
 * ctx : { jetons, mode ('rogue' | 'saison'), ouverts (cle → true | 'raison du verrou'),
 *         mods (patrons : rabais, holo, carteExtra, sansBase), sansHolo (packs d'affilée),
 *         duJour { pack, rabais }, franchises [{ cle, nom }], saisons [labels], coachs [{ cle, nom }], coachRun,
 *         scelles [{ palier, cle, verrou }], ouvrirScelle(palier),
 *         acheter(cle, { prix, params, scelle }), onFerme() }
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
      <p class="pk-num">Son rang dans sa vraie saison, parmi les réguliers de son poste : aux points par match, aux buts évités pour un gardien. Sans joueur de ce niveau ${manque}, la carte prend le niveau le plus proche.</p>
      ${mods.prestige ? `<p class="pk-num">📈 ${esc(mods.prestige.nom)} : ton prestige ouvre les Étoiles et les Phénomènes, run après run.${mods.coach && COACHS[mods.coach] ? ` ${COACHS[mods.coach].ico} Le dépisteur ${esc(COACHS[mods.coach].de)} recrute ${esc(COACHS[mods.coach].recrute)}.` : ''}</p>` : ''}`;
}
export function ouvrirMagasin(ctx) {
  // Dans une page du Marché (`ctx.dans`, `ctx.fermer`, js/game.js) ou dans sa fenêtre.
  const m = ctx.dans || $('magasinModal');
  if (!m) return;
  const rabaisDe = cle => (ctx.mods.rabais || 1) * (ctx.duJour && ctx.duJour.pack === cle ? ctx.duJour.rabais : 1);
  const tuile = (cle, jour = false) => {
    const P = PACKS_TOUS[cle];
    if (!P) return '';
    const verrou = ctx.ouverts[cle] === true ? '' : (ctx.ouverts[cle] || 'Verrouillé');
    const prix = prixDe(cle, rabaisDe(cle));
    const ch = chancesDe(cle, P.sorte === 'joueurs' ? ctx.mods : {});
    const phare = P.sorte === 'joueurs' ? ch.find(x => x.nom === 'Holo ou mieux') : ch[0];
    const tier = P.sorte === 'cartes' ? 'cartes' : P.tier;
    const n = cartesDuPack(cle, ctx.mods);
    // 1.0 (R5) : un pack impayable se grise et dit ce qui manque ; il s'ouvre encore (sa fiche explique).
    const manque = !verrou && ctx.jetons < prix ? prix - ctx.jetons : 0;
    return `<button type="button" class="pk-tuile pk-${tier}${jour ? ' pk-jour' : ''}${verrou ? ' verrou' : ''}${manque ? ' pk-cher' : ''}" data-pack="${esc(cle)}"${verrou ? ` title="${esc(verrou)}"` : manque ? ` title="Il te manque ${manque} 🪙"` : ''}>
      <span class="pk-sachet" aria-hidden="true"><span class="pk-dent"></span><span class="pk-ico">${P.ico}</span><span class="pk-tier">${esc(tier === 'cartes' ? 'Cartes' : TIERS[P.tier].nom)}</span></span>
      <span class="pk-nom">${esc(P.nom)}</span>
      <span class="pk-n">${n} carte${n > 1 ? 's' : ''}</span>
      ${phare ? `<span class="pk-cote">${esc(phare.nom)} : ${esc(phare.txt)}</span>` : ''}
      <span class="pk-prix">${verrou ? '🔒' : `${rabaisDe(cle) < 1 ? `<s>${P.prix}</s> ` : ''}${prix} 🪙`}${manque ? `<span class="pk-manque">il te manque ${manque} 🪙</span>` : ''}</span>
    </button>`;
  };
  // 1.0 (R5) : à la première run, la boutique commence par quatre packs ; le reste attend « Voir les N packs ».
  const DEBUT = ['j:hasard_bronze', 'j:hasard_argent', 'c:match', 'c:consommables'];
  let tout = !ctx.debutant;
  let ongletClub = 'nom';
  const dessiner = () => {
    const rayons = tout ? RAYONS.map(R => {
      if (R.cle === 'jour') return ctx.duJour ? `<section class="pk-rayon pk-rayon-jour"><h3>${R.ico} ${esc(ctx.mode === 'rogue' ? 'Le pack de la semaine' : R.nom)} <span class="pk-rabais">−${Math.round((1 - ctx.duJour.rabais) * 100)} % ${ctx.mode === 'rogue' ? 'cette semaine' : 'aujourd\'hui'}</span></h3><div class="pk-rangee">${tuile(ctx.duJour.pack, true)}</div></section>` : '';
      return `<section class="pk-rayon"><h3>${R.ico} ${esc(R.nom)}</h3><div class="pk-rangee">${R.packs.map(k => tuile(k)).join('')}</div></section>`;
    }).join('')
      : `<section class="pk-rayon pk-rayon-debut"><h3>🎒 Pour commencer</h3><div class="pk-rangee">${DEBUT.filter(k => PACKS_TOUS[k]).map(k => tuile(k)).join('')}</div>
        <button type="button" class="btn pk-tout">Voir les ${Object.keys(PACKS_TOUS).length} packs</button></section>`;
    /* TES PACKS (1.0, oct.) : achetés sans les ouvrir. JP : *séparer le marché des cartes déjà achetées, en bas*.
       Le haut de la boutique est le marché ; ce qui est déjà à toi vit à part, en bas, et une ligne en tête y mène. */
    const nScelles = (ctx.scelles || []).length;
    const scelles = nScelles ? `<section class="pk-rayon pk-rayon-scelles"><h3>📦 Déjà à toi · ${nScelles} à ouvrir</h3><div class="pk-rangee">${ctx.scelles.map(x => {
      const P = PACKS_TOUS[x.cle];
      return `<button type="button" class="pk-tuile pk-${P.sorte === 'cartes' ? 'cartes' : P.tier}${x.verrou ? ' verrou' : ''}" data-scelle="${esc(x.palier)}"${x.verrou ? ` title="${esc(x.verrou)}"` : ''}>
        <span class="pk-sachet" aria-hidden="true"><span class="pk-dent"></span><span class="pk-ico">${P.ico}</span><span class="pk-tier">Scellé</span></span>
        <span class="pk-nom">${esc(P.nom)}</span>
        <span class="pk-prix">${x.verrou ? `🔒 ${esc(x.verrou)}` : 'Ouvrir'}</span>
      </button>`;
    }).join('')}</div></section>` : '';
    /*
     * TON CLUB (1.0, oct.) : les noms, les couleurs et les écussons, en jetons comme les packs. Trois onglets
     * (huit noms, cinquante couleurs, trente écussons) : un nom et un écusson se montrent SUR ton écusson,
     * une couleur en nuancier, l'aplat et la seconde.
     */
    const offres = (ctx.club || []).filter(o => o.sorte === ongletClub);
    const club = (ctx.club || []).length ? `<section class="pk-rayon pk-rayon-club"><h3>🏅 Ton club · ${ctx.club.length} à débloquer</h3>
      <div class="stat-tabs" role="tablist">${RAYONS_CLUB.map(R => `<button type="button" role="tab" class="stat-tab${R.cle === ongletClub ? ' on' : ''}" aria-selected="${R.cle === ongletClub}" data-onglet="${R.cle}">${esc(R.titre)} · ${(ctx.club || []).filter(o => o.sorte === R.cle).length}</button>`).join('')}</div>
      <div class="pk-rangee${ongletClub === 'palette' ? ' pk-nuancier' : ''}">${offres.map(o => {
      const manque = !o.verrou && ctx.jetons < o.prix ? o.prix - ctx.jetons : 0;
      const visuel = o.nuance ? `<span class="pk-nuance" aria-hidden="true" style="--n1:${o.nuance[0]};--n2:${o.nuance[1]}"></span>` : `<span class="pk-club-ecu" aria-hidden="true">${o.apercu}</span>`;
      return `<button type="button" class="pk-tuile pk-club${o.verrou ? ' verrou' : ''}${manque ? ' pk-cher' : ''}" data-club="${esc(o.cle)}"${o.verrou ? ` title="${esc(o.verrou)}"` : manque ? ` title="Il te manque ${manque} 🪙"` : ''}>
        ${visuel}
        <span class="pk-nom">${esc(o.nom)}</span>
        <span class="pk-prix">${o.verrou ? '🔒' : `${o.prix} 🪙`}</span>
      </button>`;
    }).join('') || '<p class="pk-mot">Tout est à toi.</p>'}</div></section>` : '';
    const garantie = ctx.mode === 'rogue'
      ? `<p class="pk-garantie">🛟 Une holo ou une or au plus tard au ${PITIE + 1}e pack de joueurs${ctx.sansHolo ? ` (tu en es à ${ctx.sansHolo} sans)` : ''}.</p>` : '';
    // LE PLAFOND (S79) : un pack de joueurs ne tire que des salaires qu'une sortie ferait entrer.
    const plafond = ctx.plafond
      ? `<p class="pk-plafond${ctx.plafond.espace < 0 ? ' over' : ''}">💵 ${ctx.plafond.espace >= 0 ? `${M(ctx.plafond.espace)} sous le plafond de ${M(ctx.plafond.cap)}` : `${M(-ctx.plafond.espace)} au-dessus du plafond de ${M(ctx.plafond.cap)}`}${ctx.plafond.tordu ? ' ✦' : ''} : salaires jusqu'à ${M(Math.max(0, ctx.plafond.salaireMax))} dans un pack de joueurs.</p>` : '';
    m.innerHTML = `<div class="choix-sheet pk-sheet" role="dialog" aria-modal="true" aria-label="La boutique">
      <div class="choix-tete">
        <span class="choix-ico">🛒</span>
        <div class="choix-titres"><div class="choix-titre">La boutique</div><div class="choix-irl">🪙 ${ctx.jetons} jetons${ctx.mods.rabais && ctx.mods.rabais < 1 ? ` · rabais −${Math.round((1 - ctx.mods.rabais) * 100)} %` : ''}</div></div>
        <button type="button" class="close-btn choix-fermer" aria-label="Fermer" title="Fermer">✕</button>
      </div>
      <div class="choix-corps pk-corps">
        <p class="pk-mot">${ctx.ferme ? `🔒 ${esc(ctx.ferme)}.` : 'Joueurs : tu en signes un. Cartes : dans ta poche.'}</p>
        ${nScelles ? `<button type="button" class="btn small pk-aller">📦 ${nScelles} pack${nScelles > 1 ? 's' : ''} à ouvrir, en bas ↓</button>` : ''}
        ${garantie}
        ${plafond}
        ${rayons}
        ${tout ? club : ''}
        ${scelles}
      </div>
    </div>`;
    m.querySelector('.choix-fermer').onclick = () => fermer();
    m.querySelectorAll('[data-pack]').forEach(b => { b.onclick = () => fiche(b.dataset.pack); });
    m.querySelectorAll('[data-scelle]').forEach(b => { b.onclick = () => { if (b.classList.contains('verrou')) return; fermer(true); ctx.ouvrirScelle(b.dataset.scelle); }; });
    m.querySelectorAll('[data-club]').forEach(b => { b.onclick = () => ficheClub(ctx.club.find(o => o.cle === b.dataset.club)); });
    m.querySelectorAll('[data-onglet]').forEach(b => { b.onclick = () => {
      const corps = m.querySelector('.pk-corps'), haut = corps ? corps.scrollTop : 0;
      ongletClub = b.dataset.onglet; dessiner();
      const c2 = m.querySelector('.pk-corps'); if (c2) c2.scrollTop = haut;
    }; });
    const aller = m.querySelector('.pk-aller');
    if (aller) aller.onclick = () => m.querySelector('.pk-rayon-scelles').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const voirTout = m.querySelector('.pk-tout');
    if (voirTout) voirTout.onclick = () => { tout = true; dessiner(); };
  };
  const fiche = cle => {
    const P = PACKS_TOUS[cle];
    const verrou = ctx.ouverts[cle] === true ? '' : (ctx.ouverts[cle] || 'Verrouillé');
    const prix = prixDe(cle, rabaisDe(cle));
    const ch = chancesDe(cle, P.sorte === 'joueurs' ? ctx.mods : {});
    const cotes = P.sorte === 'joueurs' ? cotesDuPack(cle, ctx.mods) : P.cotes;
    const tot = Object.values(cotes).reduce((a, b) => a + b, 0) || 100;
    const noms = P.sorte === 'joueurs' ? { commune: 'Base', peu: 'Parallèle', rare: 'Holo', legendaire: 'Or numérotée' } : { commune: 'Commune', peu: 'Peu commune', rare: 'Rare', legendaire: 'Légendaire' };
    const choix = P.choix === 'franchise'
      ? `<label class="pk-choix">La franchise <select id="pkParam"><option value="">🎲 Au hasard</option>${ctx.franchises.map(f => `<option value="${esc(f.cle)}">${esc(f.nom)}</option>`).join('')}</select></label>`
      : P.choix === 'saison'
        ? `<label class="pk-choix">La saison <select id="pkParam"><option value="">🎲 Au hasard</option>${ctx.saisons.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select></label>`
        : P.choix === 'coach' && ctx.coachs
          ? `<label class="pk-choix">Le coach <select id="pkParam"><option value="">🎲 Au hasard</option>${ctx.coachs.map(c => `<option value="${esc(c.cle)}"${c.cle === ctx.coachRun ? ' selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>` : '';
    const peut = !verrou && ctx.jetons >= prix;
    const d = document.createElement('div');
    d.className = 'pk-fiche';
    d.innerHTML = `<div class="pk-fiche-carte pk-${P.sorte === 'cartes' ? 'cartes' : P.tier}">
      <div class="pk-fiche-tete"><span class="pk-ico">${P.ico}</span><div><div class="pk-fiche-nom">${esc(P.nom)}</div><div class="pk-fiche-sous">${cartesDuPack(cle, P.sorte === 'joueurs' ? ctx.mods : {})} cartes · ${prix} 🪙</div></div></div>
      <p class="pk-fiche-texte">${esc(P.texte)}</p>
      <h4>Les chances, par pack</h4>
      <table class="pk-chances">${ch.map(x => `<tr${x.maudite ? ' class="pk-maudite"' : x.niveau ? ' class="pk-niveau"' : ''}><th>${esc(x.nom)}</th><td>${esc(x.txt)}</td></tr>`).join('')}</table>
      ${P.sorte === 'joueurs' && ctx.plafond ? `<p class="pk-num">💵 Salaires tirés : jusqu'à ${M(Math.max(0, ctx.plafond.salaireMax))} (ton espace, plus le plus gros contrat qu'une sortie libérerait).</p>` : ''}
      ${P.sorte === 'joueurs' ? niveauxHtml(cle, ctx.mods) : ''}
      <h4>${P.sorte === 'joueurs' ? 'La finition d\'une carte' : 'Le barème d\'une carte'}</h4>
      <table class="pk-bareme">${Object.entries(cotes).map(([k, v]) => `<tr><th>${RARETES[k] ? RARETES[k].gemme : ''} ${esc(noms[k] || k)}</th><td>${(Math.round((v / tot) * 1000) / 10).toString().replace('.', ',')} %</td></tr>`).join('')}</table>
      ${P.sorte === 'joueurs' ? `<p class="pk-num">Une or est numérotée : ${NUMEROS.map(([n, w]) => `${esc(n)} ${w} %`).join(' · ')}. Le numéro est un honneur, pas un bonus.</p>` : ''}
      ${choix}
      ${verrou ? `<p class="pk-verrou">🔒 ${esc(verrou)}</p>` : ''}
      <div class="pk-fiche-actions">
        <button type="button" class="btn pk-retour">Retour</button>
        ${peut && ctx.ouvrirScelle ? '<button type="button" class="btn pk-sceller" title="Payé tout de suite ; il t\'attend dans « Tes packs », à ouvrir quand tu veux.">Garder scellé</button>' : ''}
        <button type="button" class="btn gold pk-acheter"${peut ? '' : ' disabled'}>${verrou ? 'Verrouillé' : ctx.jetons >= prix ? `Acheter · ${prix} 🪙` : `Il te manque ${prix - ctx.jetons} 🪙`}</button>
      </div>
    </div>`;
    m.querySelector('.choix-sheet').appendChild(d);
    d.querySelector('.pk-retour').onclick = () => d.remove();
    const achat = d.querySelector('.pk-acheter');
    const payer = scelle => {
      if (!peut) return;
      const v = d.querySelector('#pkParam');
      const params = P.choix ? { [P.choix]: v && v.value ? v.value : null } : {};
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
      <p class="pk-fiche-texte">${esc(o.rayon)} de ton club : à toi pour toutes tes parties, porté tout de suite, et changé quand tu veux aux déblocages. Ça ne change rien au jeu.</p>
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
