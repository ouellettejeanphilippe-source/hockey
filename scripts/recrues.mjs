/**
 * LA VRAIE SAISON RECRUE DE CHAQUE JOUEUR (S79) → data/recrues.json
 *
 * JP : *je vois Crosby recrue avec stats de sa deuxième saison ?*. Le ruban
 * « Recrue » suivait le CONTRAT D'ENTRÉE (`elc`), qui dure jusqu'à trois
 * saisons : Crosby 2006-07 (120 points, sa deuxième) portait le ruban. Une
 * carte recrue, c'est la saison recrue — une seule par joueur.
 *
 * La règle, au plus près de celle de la LNH avec ce que la base contient
 * (les shards ne gardent que les saisons de 10 matchs et plus) :
 *   - la saison recrue est la PREMIÈRE saison du joueur dans la base ;
 *   - sauf si elle compte moins de 25 matchs et qu'une saison pleine (25 et
 *     plus) la suit : c'est alors celle-là (la LNH garde le statut de recrue
 *     à qui n'a pas joué 25 matchs une saison précédente) ;
 *   - la base commence en 1970-71 : un joueur qui y apparaît cette saison-là
 *     n'est une recrue que s'il avait 21 ans ou moins (Perreault, oui ;
 *     Béliveau, non — il jouait depuis vingt ans).
 *
 * Sortie : { "2005-06": [8471675, …], … } — des identifiants LNH, par saison.
 *
 *   node scripts/recrues.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const PREMIERE_BASE = 1970;
const PLEINE = 25;

const age = (bd, annee) => {
  if (!bd) return null;
  const [y, m] = bd.split('-').map(Number);
  // L'âge au 15 septembre de la saison, comme partout ailleurs dans le jeu.
  return annee - y - (m > 9 ? 1 : 0);
};

const parJoueur = new Map();   // id → [{ annee, label, gp, bd }]
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.json')).sort()) {
  const shard = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const label = shard.season || f.slice(0, -5);
  const annee = parseInt(label.slice(0, 4), 10);
  for (const p of shard.players) {
    if (p.id == null) continue;
    if (!parJoueur.has(p.id)) parJoueur.set(p.id, []);
    const l = parJoueur.get(p.id);
    // Un joueur échangé apparaît deux fois dans une saison : on additionne ses matchs.
    const deja = l.find(x => x.label === label);
    if (deja) deja.gp += p.gp || 0;
    else l.push({ annee, label, gp: p.gp || 0, bd: p.bd || null });
  }
}

const out = {};
let n = 0, exclus = 0;
for (const [id, saisons] of parJoueur) {
  saisons.sort((a, b) => a.annee - b.annee);
  const s0 = saisons[0];
  if (s0.annee === PREMIERE_BASE) {
    const a = age(s0.bd, s0.annee);
    if (a == null || a > 21) { exclus++; continue; }
  }
  let recrue = s0;
  const s1 = saisons[1];
  if (s0.gp < PLEINE && s1 && s1.annee === s0.annee + 1 && s1.gp >= PLEINE) recrue = s1;
  (out[recrue.label] = out[recrue.label] || []).push(Number(id));
  n++;
}
for (const k of Object.keys(out)) out[k].sort((a, b) => a - b);
const trie = Object.fromEntries(Object.keys(out).sort().map(k => [k, out[k]]));
fs.writeFileSync(path.join(ROOT, 'data', 'recrues.json'), JSON.stringify(trie));
console.log(`${n} saisons recrues sur ${Object.keys(trie).length} saisons ; ${exclus} joueurs déjà dans la LNH avant 1970-71`);
