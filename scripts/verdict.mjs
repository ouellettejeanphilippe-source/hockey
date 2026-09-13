/*
 * LE VERDICT — un script de vérification doit pouvoir ÉCHOUER.
 *
 * L'audit du dépôt a trouvé que sept scripts de `scripts/` n'appelaient
 * jamais `process.exit` : les buts par match du plateau, la monotonie sur dix
 * déciles, la rareté des traits, la corrélation force/classement — tout ce qui
 * fait autorité dans CLAUDE.md était un `console.log`. Un chiffre qu'on
 * imprime sans le juger est un chiffre que personne ne relit, et
 * `build-data.yml` commite sur main avec `check_ratings.mjs` comme seul
 * portier.
 *
 * Deux natures de mesure, et elles ne se jugent pas pareil :
 *
 *   INVARIANT   une égalité de feuille, un nom qui doit exister, une suite qui
 *               doit monter. Faux = le dépôt est cassé. `exiger()`.
 *   REPÈRE      les buts par match, une corrélation, une part. Il varie, mais
 *               pas de n'importe combien : `borne()` prend l'intervalle que
 *               CLAUDE.md écrit déjà, jamais un intervalle inventé plus serré
 *               que la mesure — un garde-fou qui crie pour du bruit se
 *               désactive au bout de deux semaines, et alors il ne garde plus
 *               rien.
 *
 * `informer()` existe pour ce qui se lit sans se juger (une distribution, un
 * tableau de calibration). Écrire un repère en `informer` est un choix, pas un
 * oubli : dis pourquoi sur place.
 */

const lignes = [];
let echecs = 0;

const num = x => (Math.round(x * 1000) / 1000).toString();

/** Un invariant : vrai, ou le dépôt est cassé. */
export function exiger(nom, ok, detail = '') {
  lignes.push({ ok: !!ok, nom, detail });
  if (!ok) echecs++;
  return !!ok;
}

/** Un repère : dans l'intervalle écrit dans CLAUDE.md, ou on veut le savoir. */
export function borne(nom, valeur, min, max, unite = '') {
  const ok = Number.isFinite(valeur) && valeur >= min && valeur <= max;
  return exiger(nom, ok, `${num(valeur)}${unite} (attendu ${num(min)} à ${num(max)}${unite})`);
}

/** Une suite qui ne doit jamais redescendre — la monotonie des déciles. */
export function monte(nom, suite, tolerance = 0) {
  const fautes = [];
  for (let i = 1; i < suite.length; i++) {
    if (suite[i] < suite[i - 1] - tolerance) fautes.push(`${i} : ${num(suite[i - 1])} → ${num(suite[i])}`);
  }
  return exiger(nom, !fautes.length, fautes.length ? fautes.join(', ') : `${suite.length} paliers`);
}

/** Ce qui se lit sans se juger. */
export function informer(nom, texte) {
  lignes.push({ ok: null, nom, detail: texte });
}

/**
 * À appeler à la fin du script. Imprime le tableau et POSE LE CODE DE SORTIE —
 * `process.exitCode` plutôt que `process.exit`, pour que la sortie déjà
 * écrite finisse de partir.
 */
export function verdict(titre = 'Verdict') {
  const large = Math.max(...lignes.map(l => l.nom.length), 10);
  console.log(`\n${titre}`);
  for (const l of lignes) {
    const marque = l.ok === null ? '·' : l.ok ? '✓' : '✗';
    console.log(`  ${marque} ${l.nom.padEnd(large)}  ${l.detail}`);
  }
  if (echecs) {
    console.log(`\n  ${echecs} vérification${echecs > 1 ? 's' : ''} en échec.`);
    process.exitCode = 1;
  } else {
    const n = lignes.filter(l => l.ok !== null).length;
    console.log(`\n  ${n} vérification${n > 1 ? 's' : ''}, toutes vertes.`);
  }
  return !echecs;
}
