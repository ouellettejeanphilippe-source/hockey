/*
 * LE MODE SUR TABLE SE CHARGE À LA DEMANDE (1.0, J3-6). Le plateau, son
 * moteur et le tournoi pèsent 400 Ko de modules qu'une partie de saison ou
 * de Rogue ne lit jamais : ils ne partent plus avec le premier écran. Le
 * premier rendu en mode table (js/game.js, `render`) les attend, puis tout ce
 * qui est lu ici l'est de façon synchrone (`MT.statsDeTable(p)`…).
 *
 * Chaque nom est NOMMÉ ici, pas lu par `import *` : ce fichier est le seul
 * endroit qui dit ce que le reste du jeu prend du mode table (et
 * scripts/check_mort.mjs le lit ainsi). Le travailleur de service garde ces
 * modules en cache : hors ligne, rien ne change.
 */
export const MT = { pret: false };
let promesse = null;

export function chargerTable() {
  if (!promesse) {
    promesse = Promise.all([import('./table.js'), import('./tournoi.js'), import('./modes-table.js')])
      .then(([
        { statsDeTable, AXE_MOT, GABARITS, TIRS, HABILETES, habileteDe },
        { CLUBS, etatDuTournoi },
        { lancerTournoi, reprendreTournoi, jouerExhibition, remplirReglesDuPlateau },
      ]) => Object.assign(MT, {
        statsDeTable, AXE_MOT, GABARITS, TIRS, HABILETES, habileteDe,
        CLUBS_TOURNOI: CLUBS, etatDuTournoi,
        lancerTournoi, reprendreTournoi, jouerExhibition, remplirReglesDuPlateau,
        pret: true,
      }))
      .catch(e => { promesse = null; throw e; });
  }
  return promesse;
}
