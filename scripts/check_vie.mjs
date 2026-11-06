/*
 * LE JOUEUR DU FAIT (V11, tranche 5 ; js/vie-gm.js `joueurDuFait`). V20 : les courriels et les points de presse sont partis
 * (docs/refonte-v20.md § 3) ; reste ce que les dossiers en gardent — un fait d'équipe se lit par quelqu'un de l'effectif,
 * dans les feuilles qu'il raconte (le gardien du dernier soir, le meilleur pointeur, le plus puni), habillé.
 *
 *   node scripts/check_vie.mjs
 */
import { joueurDuFait } from '../js/vie-gm.js';
import { vraieMot } from '../js/faits.js';
import { exiger, verdict } from './verdict.mjs';

// LE JOUEUR DU FAIT (V11, tranche 5) : la question vise celui dont le fait vient, dans les feuilles qu'elle raconte, habillé.
{
  const roy = { n: 'Patrick Roy', p: 'G' }, sakic = { n: 'Joe Sakic', p: 'C' }, foote = { n: 'Adam Foote', p: 'D' }, parti = { n: 'Claude Lemieux', p: 'RW' };
  const habilles = new Set([roy, sakic, foote]);
  const feuilles = [
    { cote: 'A', f: { buts: [{ cote: 'A', marqueur: sakic, passeurs: [foote] }, { cote: 'A', marqueur: parti, passeurs: [sakic] }], punitions: [{ cote: 'A', joueur: foote }], lancers: [] } },
    { cote: 'B', f: { buts: [{ cote: 'B', marqueur: sakic, passeurs: [] }, { cote: 'A', marqueur: { n: 'Eux' }, gardien: roy }], punitions: [{ cote: 'B', joueur: foote }, { cote: 'A', joueur: sakic }],
      lancers: [{ cote: 'A', gardien: roy }, { cote: 'A', gardien: roy }, { cote: 'A', gardien: roy }, { cote: 'B', gardien: { n: 'Eux' } }] } },
  ];
  const g = joueurDuFait('gardien', feuilles, habilles), v = joueurDuFait('vedette', feuilles, habilles), d = joueurDuFait('dur', feuilles, habilles);
  exiger('la presse vise le joueur du fait, avec ses vrais chiffres', g && g.p === roy && g.fait === 'Patrick Roy : 1 but sur 3 tirs ce soir-là'
    && v && v.p === sakic && v.fait === 'Joe Sakic : 3 points en 2 matchs' && d && d.p === foote && d.fait === 'Adam Foote : 2 punitions en 2 matchs',
    [g, v, d].map(x => (x ? x.fait : 'rien')).join(' · '));
  const sansSakic = joueurDuFait('vedette', feuilles, new Set([roy, foote]));
  exiger('un joueur parti ne se fait pas viser ; personne dans les feuilles, la cible d\'avant', sansSakic && sansSakic.p === foote && joueurDuFait('dur', [], habilles) === null,
    sansSakic ? sansSakic.fait : 'rien');
}

// LA VRAIE SAISON AVEC SES BORNES (V25 C1, js/faits.js `vraieMot` ; JP, 5 nov. : *la vraie saison dite dans les histoires, avec ses
// bornes*) : les matchs joués toujours, le club seulement s'il n'en a eu qu'un, « jusqu'ici » si la saison est en cours, jamais « a fini ».
{
  const base = { buts: 34, passes: 20, gp: 47, matchsDeSaSaison: 82, clubs: 1, club: 'Boston', enCours: false, victoires: null, arrets: null };
  const un = vraieMot(base), deux = vraieMot({ ...base, clubs: 2 }), cours = vraieMot({ ...base, enCours: true }), g = vraieMot({ ...base, buts: null, passes: null, victoires: 33, arrets: 0.914 });
  exiger('la vraie saison se dit en matchs joués, avec le club s\'il n\'en a eu qu\'un', un === 'cette année-là, 34 buts en 47 matchs avec Boston', un);
  exiger('un joueur échangé dans sa saison : les mêmes matchs, aucun club nommé', deux === 'cette année-là, 34 buts en 47 matchs', deux);
  exiger('une saison en cours se dit « jusqu\'ici », jamais « a fini »', cours === 'jusqu\'ici, 34 buts en 47 matchs avec Boston' && !/fini/.test(cours), cours);
  exiger('un gardien : ses victoires et son efficacité', g === 'cette année-là, 33 victoires en 47 matchs, ,914 d\'efficacité avec Boston', g);
  exiger('sans match joué, rien ne se dit', vraieMot({ ...base, gp: 0 }) === '' && vraieMot(null) === '');
}

verdict('Le joueur du fait');
