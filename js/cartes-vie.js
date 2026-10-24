/**
 * « UNE SAISON DANS LA VIE D'UN DG-COACH » — les cartes neuves de la banque.
 *
 * Une table, dans le MÊME format que celles qu'elles rejoignent. Aucun
 * canal neuf, aucune mécanique neuve : chaque carte passe par les champs que
 * le moteur lit déjà, dans les amplitudes de ses voisines de même rareté. La
 * couleur d'une carte (son coach) n'est écrite nulle part : `coachDesCanaux`
 * (js/coachs.js) la lit sur ce que la carte fait ; une carte qui ne bouge
 * presque rien est neutre.
 *
 *   CARTES_MATCH_VIE    au format de CARTES_MATCH (js/combat.js), toutes `horsAdverse`
 *
 * Ce fichier n'importe rien : il est de la donnée, et banque.js et combat.js
 * peuvent l'importer sans cycle. V16 : les clauses (`MODIFS_VIE`) sont parties, devenues le fiscaliste
 * (js/personnel.js) ; les soins et les contrats aussi (tranche 6, docs/refonte-v16.md § 4d).
 */

/* ---------- LES CARTES DE MATCH (v2, l'adversaire ne les pige pas : `horsAdverse`) ---------- */
export const CARTES_MATCH_VIE = {
  // le Frelon : des tirs
  // l'Aigle : de la précision
  // la Tortue : fermer la porte
  // le Rhino : le contact
  // le Doc : les jambes
  // l'Abbé : la discipline
  // le Contremaître : tout le monde joue
  // le Showman : les vedettes
  // neutres : le dépistage et les rabais

  // Nouvelles cartes de match

};
