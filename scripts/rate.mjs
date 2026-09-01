/**
 * Pont entre le script Python de build et js/ratings.js.
 *
 * Lit sur stdin { label, minGP, skaters, goalies, realtime } et écrit le
 * shard sur stdout. Existe pour qu'il n'y ait qu'UNE implémentation des
 * cotes — celle que le navigateur utilise aussi.
 *
 *   echo '{...}' | node scripts/rate.mjs
 */

import { buildSeasonShard } from '../js/ratings.js';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { raw += c; });
process.stdin.on('end', () => {
  const { label, minGP, skaters, goalies, realtime } = JSON.parse(raw);
  const shard = buildSeasonShard(label, skaters, goalies, realtime || null, minGP);
  process.stdout.write(JSON.stringify(shard));
});
