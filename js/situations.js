/**
 * Dilemmes de plus, dans le MÊME format que MOMENTS (js/sim.js).
 * `brancherMoments` les ajoute au catalogue vivant : le tirage, l'écran et
 * le moteur les jouent comme les autres. Pas de cote neuve, pas de canal neuf.
 */
const JOURS_PLUS = [8, 42];

const MOMENTS_PLUS = {
  virus: {
    ico: '🤒', titre: 'Le virus du vestiaire', irl: null,
    recit: 'Trois gars toussent depuis mardi. Le médecin veut qu\'on ralentisse.',
    options: [
      { cle: 'ralentir', nom: 'Pratiques courtes, une semaine', bon: 'Moins de corps à terre', prix: 'Le rythme tombe', volume: 0.92, blessure: 0.76, duree: 7 },
      { cle: 'jouer', nom: 'On joue quand même', bon: 'L\'alignement ne bouge pas', prix: 'Ça peut se répandre', blessure: 1.32, duree: 6 },
    ],
  },
  glace: {
    ico: '🧊', titre: 'La glace est molle', irl: null,
    recit: 'La surfaceuse a lâché. La glace est lente, et tout le monde le sait.',
    options: [
      { cle: 'cycle', nom: 'On cycle, on ne patine pas', bon: 'On garde la rondelle', prix: 'Moins de lancers', volume: 0.905, finition: 1.08, duree: 4 },
      { cle: 'tirer', nom: 'On tire de partout quand même', bon: 'Le volume reste', prix: 'Les lancers meurent dans la mélasse', volume: 1.08, finition: 0.92, duree: 4 },
    ],
  },
  hymne: {
    ico: '🎤', titre: 'L\'hymne n\'en finit plus', irl: null,
    recit: 'Le chanteur étire. Le vestiaire rit, ou grince, selon toi.',
    options: [
      { cle: 'rire', nom: 'On en rit', bon: 'La pression tombe', prix: 'On se relâche derrière', finition: 1.088, defense: 1.04, duree: 3 },
      { cle: 'serieux', nom: 'On reste de glace', bon: 'Concentrés devant le filet', defense: 0.94, duree: 3 },
    ],
  },
  masque: {
    ico: '🥅', titre: 'Le masque neuf', irl: null, cible: 'gardien',
    recit: '{nom} dévoile un masque neuf. Il dit que ça change sa vue. Personne n\'en est sûr.',
    options: [
      { cle: 'garder', nom: 'Il le garde', bon: 'Une fois sur deux, il y voit mieux', prix: 'Sinon, le masque le gêne',
        pari: { chance: 0.5, gagne: { defense: 0.92, duree: 8 }, perd: { defense: 1.08, duree: 4 } } },
      { cle: 'ancien', nom: 'On ressort l\'ancien', bon: 'Il connaît ses angles', defense: 0.96, duree: 6 },
    ],
  },
  arbitre: {
    ico: '🦓', titre: 'L\'arbitre qu\'on connaît', irl: null,
    recit: 'C\'est le même qu\'en octobre. Cette fois-là, il avait le sifflet long.',
    options: [
      { cle: 'propre', nom: 'On joue propre', bon: 'Moins de punitions', prix: 'Moins de liberté', discipline: 0.81, volume: 0.94, duree: 3 },
      { cle: 'bord', nom: 'On joue à la limite', bon: 'Plus de présence', prix: 'Il va siffler', discipline: 1.235, finition: 1.06, duree: 3 },
    ],
  },
  classe: {
    ico: '🎒', titre: 'Une classe dans le vestiaire', irl: null,
    recit: 'Trente enfants, des crayons, et le capitaine qui ne sait plus où se mettre.',
    options: [
      { cle: 'rester', nom: 'On reste avec eux', bon: 'Le vestiaire est léger', prix: 'Une heure de plus debout', finition: 1.08, energie: 1.096, duree: 4 },
      { cle: 'porte', nom: 'On ferme la porte', bon: 'La routine tient : on joue discipliné', discipline: 0.84, duree: 4 },
    ],
  },
  charter: {
    ico: '✈️', titre: 'Le proprio coupe la classe affaires', irl: null,
    recit: 'Les vols de l\'Ouest se font en économique. Les sièges sont étroits, les nuits courtes.',
    options: [
      { cle: 'encaisser', nom: 'On encaisse', prix: 'Les jambes arrivent lourdes', action: { energieTous: -12 } },
      { cle: 'bus', nom: 'On part la veille', bon: 'On dort à l\'hôtel', prix: 'Une journée de pratique en moins', volume: 0.94, blessure: 0.872, duree: 5 },
    ],
  },
  journal: {
    ico: '🎙️', titre: 'Le micro est resté ouvert', irl: null,
    recit: 'Ton entraîneur parle du 4e trio sans savoir que ça enregistre. La bande sort le lendemain.',
    options: [
      { cle: 'assumer', nom: 'Il assume devant eux', bon: 'Si le vestiaire embarque, ça brasse', prix: 'Sinon, le 4e boude',
        pari: { chance: 0.5, gagne: { volume: 1.095, duree: 6 }, perd: { finition: 0.92, duree: 6 } } },
      { cle: 'excuses', nom: 'Des excuses, et on passe', bon: 'La page se tourne', defense: 0.96, duree: 4 },
    ],
  },
};

/** Ajoute les dilemmes et les journées au catalogue déjà chargé par le moteur. */
export function brancherMoments(MOMENTS, JOURS) {
  for (const [k, v] of Object.entries(MOMENTS_PLUS)) if (!MOMENTS[k]) MOMENTS[k] = v;
  for (const j of JOURS_PLUS) if (!JOURS.includes(j)) JOURS.push(j);
  JOURS.sort((a, b) => a - b);
}
