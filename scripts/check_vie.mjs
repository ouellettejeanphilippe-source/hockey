/*
 * LE JOUEUR DU FAIT (V11, tranche 5 ; js/vie-gm.js `joueurDuFait`). V20 : les courriels et les points de presse sont partis
 * (docs/refonte-v20.md § 3) ; reste ce que les dossiers en gardent — un fait d'équipe se lit par quelqu'un de l'effectif,
 * dans les feuilles qu'il raconte (le gardien du dernier soir, le meilleur pointeur, le plus puni), habillé.
 *
 *   node scripts/check_vie.mjs
 */
import { joueurDuFait } from '../js/vie-gm.js';
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

verdict('Le joueur du fait');
