/**
 * LE DÉ SE LIT (1.0). JP : *quand ya un lancement de dés, genre malus ou bonus avec %, je vois pas ce qui a
 * gagné*. Chaque option à pari du jeu (les dilemmes, les séquences, les avant-matchs, les ajustements des
 * séries) doit pouvoir dire, une fois tirée : sa chance, le bord gagnant, et l'effet qui s'applique — des deux
 * côtés. `issueDePari` est le seul texte, repris par le bureau, le direct, le sommaire et le journal.
 *
 *   node scripts/check_paris.mjs
 */
import { MOMENTS, SEQUENCES, AVANT_GROS, AJUSTEMENTS, issueDePari } from '../js/sim.js';

let ok = 0; const fautes = [];
const verifier = (c, v) => { if (v) ok++; else fautes.push(c); };
const options = [];
const fouiller = (o, ou) => {
  if (!o || typeof o !== 'object') return;
  if (o.pari && typeof o.pari.chance === 'number') options.push([ou, o]);
  for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object' && k !== 'pari') fouiller(v, `${ou}.${k}`);
};
for (const [nom, T] of Object.entries({ MOMENTS, SEQUENCES, AVANT_GROS, AJUSTEMENTS })) fouiller(T, nom);

for (const [ou, o] of options) for (const gagne of [true, false]) {
  const serie = ou.startsWith('AJUSTEMENTS');
  const x = { titre: o.nom || ou, choix: o.nom, gagne, chance: o.pari.chance, effet: (gagne ? o.pari.gagne : o.pari.perd) || null, serie };
  const i = issueDePari(x);
  verifier(`${ou} (${gagne ? 'gagné' : 'perdu'}) : la chance`, i && i.chance === Math.round(o.pari.chance * 100));
  verifier(`${ou} (${gagne ? 'gagné' : 'perdu'}) : le bord`, i && /tombe de ton bord|tombe du mauvais bord/.test(i.issue));
  const vide = !x.effet || !Object.keys(x.effet).some(k => k !== 'duree' && k !== 'apres');
  verifier(`${ou} (${gagne ? 'gagné' : 'perdu'}) : l'effet « ${i && i.effet} »`, i && (vide ? i.effet === 'rien de plus' : i.effet !== 'rien de plus'));
}
verifier(`au moins dix options à pari trouvées (${options.length})`, options.length >= 10);

console.log(`  ${options.length} options à pari, des deux bords.`);
if (fautes.length) { for (const f of fautes) console.log(`  ✗ ${f}`); process.exit(1); }
console.log(`  ${ok} vérifications, toutes vertes.`);
