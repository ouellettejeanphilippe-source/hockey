/**
 * PUBLIER L'APK SUR GITHUB (1.0). La version web offre « Application Android » au pied de l'écran titre
 * (js/menu.js) : son lien suit `releases/latest/download/Cap-82-0.apk`. Ce script crée (ou complète) la
 * version publiée `v<versionName>` du dépôt et y dépose mobile/Cap-82-0.apk ; un APK du même nom déjà là
 * est remplacé. L'APK ne va jamais dans le dépôt lui-même.
 *
 *   powershell -File mobile\fabriquer-apk.ps1      (fabrique mobile\Cap-82-0.apk)
 *   node scripts/publier-apk.mjs [--notes "…"]
 *
 * Le jeton : GITHUB_TOKEN, sinon celui que git garde déjà pour github.com (`git credential fill`, sans
 * jamais l'afficher ni ouvrir de fenêtre). Le commit visé doit être poussé : la version pointe dessus.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const APK = path.join(RACINE, 'mobile', 'Cap-82-0.apk');
const NOM = 'Cap-82-0.apk';
const git = (...a) => execFileSync('git', a, { cwd: RACINE, encoding: 'utf8' }).trim();

function jeton() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const r = spawnSync('git', ['credential', 'fill'], {
    cwd: RACINE, input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
  });
  const m = /^password=(.+)$/m.exec(r.stdout || '');
  return m ? m[1].trim() : null;
}

const distant = git('remote', 'get-url', 'origin');
const [, proprio, depot] = /github\.com[/:]([^/]+)\/([^/.]+)/.exec(distant) || [];
if (!proprio) throw new Error(`le dépôt distant n'est pas sur GitHub : ${distant}`);
if (!fs.existsSync(APK)) throw new Error(`pas d'APK : ${APK} (lance mobile\\fabriquer-apk.ps1)`);
const gradle = fs.readFileSync(path.join(RACINE, 'mobile', 'android', 'app', 'build.gradle'), 'utf8');
const version = (/versionName\s+"([^"]+)"/.exec(gradle) || [])[1];
if (!version) throw new Error('versionName introuvable dans build.gradle');
const commit = git('rev-parse', 'HEAD');
if (!git('branch', '-r', '--contains', commit)) throw new Error(`le commit ${commit.slice(0, 7)} n'est pas poussé`);
const iN = process.argv.indexOf('--notes');
const notes = iN > 0 ? process.argv[iN + 1] : `L'application Android de Cap 82-0, version ${version}. Installer : ouvrir le fichier sur le téléphone et accepter les sources inconnues. Les parties se gardent d'une mise à jour à l'autre.`;

const cle = jeton();
if (!cle) throw new Error('aucun jeton GitHub : GITHUB_TOKEN, ou une connexion git à github.com');
const api = async (url, opts = {}) => {
  const r = await fetch(url.startsWith('http') ? url : `https://api.github.com/repos/${proprio}/${depot}${url}`, {
    ...opts, headers: { Authorization: `Bearer ${cle}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) },
  });
  if (!r.ok && r.status !== 404) throw new Error(`${opts.method || 'GET'} ${url} : ${r.status} ${await r.text()}`);
  return r.status === 404 ? null : r.status === 204 ? {} : r.json();
};

const tag = `v${version}`;
let rel = await api(`/releases/tags/${tag}`);
if (!rel) {
  rel = await api('/releases', { method: 'POST', body: JSON.stringify({ tag_name: tag, target_commitish: commit, name: `Cap 82-0 ${version}`, body: notes, draft: false, prerelease: false, make_latest: 'true' }) });
  console.log(`version publiée créée : ${tag}`);
} else console.log(`version publiée existante : ${tag}`);
for (const a of rel.assets || []) if (a.name === NOM) { await api(`/releases/assets/${a.id}`, { method: 'DELETE' }); console.log('ancien APK retiré'); }
const octets = fs.readFileSync(APK);
const depose = await api(`https://uploads.github.com/repos/${proprio}/${depot}/releases/${rel.id}/assets?name=${NOM}`, {
  method: 'POST', headers: { 'Content-Type': 'application/vnd.android.package-archive' }, body: octets,
});
console.log(`APK déposé : ${(octets.length / 1048576).toFixed(1)} Mo · ${depose.browser_download_url}`);
console.log(`lien de la version web : https://github.com/${proprio}/${depot}/releases/latest/download/${NOM}`);
