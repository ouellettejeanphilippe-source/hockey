/*
 * LE HOOK DU GROS CHANGEMENT (4 nov. 2026 ; .claude/settings.json, UserPromptSubmit).
 * JP : *ça fait une bonne vingtaine de fois qu'on retravaille le UI et retourne
 * le même* ; *faut arrêter de juste changer la peinture*. Chaque session prenait
 * le diff minimal qui passait. Quand la demande de JP porte les mots d'un gros
 * changement (refonte, de zéro, au complet, tout, pas juste la peinture…), ce
 * script écrit dans le contexte de la session, avant qu'elle lise le code, la
 * marche à suivre : la commande /refonte, le devis, le juge check_refonte.
 * Il lit la demande sur l'entrée standard (le JSON du hook), ne refuse jamais
 * rien (le code de sortie est toujours 0) et se tait quand la demande est ordinaire.
 */
const GROS = /\b(refonte|refais|refaire|refaites|rebâti[rs]?|repens[ée]?s?|de z[ée]ro|au complet|from scratch|rebuild|redo|redesign|overhaul|gros changement|grosse refonte|tout le (ui|jeu|rogue|mode)|tous les [ée]crans|toutes les pages|all (the )?(pages|screens))\b|pas (juste|seulement|rien qu'?)\s?(une |la |de la )?(peinture|couche|skin)|(don'?t|not) just (change|a) (the )?(skin|paint|coat)/i;

let brut = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { brut += d; });
process.stdin.on('end', () => {
  let demande = '';
  try { demande = JSON.parse(brut).prompt || ''; } catch { demande = brut; }
  if (!GROS.test(demande)) return;
  console.log([
    'JP demande un GROS CHANGEMENT (CLAUDE.md, « Un gros changement »). Pas une couche de peinture :',
    '1. Charge la commande /refonte (Skill) avant de lire le code, et fais ce qu\'elle dit : l\'inventaire de ce qui existe sur le sujet, puis le devis (docs/gabarits/devis.md) avec sa partie « Ce qui part » remplie — ce qui part se nomme en `code`.',
    '2. Un gros changement se juge à ce qui part et à ce qui est réécrit, jamais à ce qu\'on ajoute par-dessus : `node scripts/check_refonte.mjs <devis>` doit être vert avant la PR (le jeu retire au moins une ligne pour deux ajoutées, style.css fait moins de la moitié du diff, chaque nom de « Ce qui part » est parti).',
    '3. Si, l\'inventaire fait, rien ne mérite de partir, dis-le à JP en une ligne AVANT de coder, avec ce que tu proposes à la place ; ne livre pas une retouche sous le nom d\'une refonte.',
  ].join('\n'));
});
