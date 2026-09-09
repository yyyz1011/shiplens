import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
export function nextVersion(configured, published) {
  const parse = (value) => {
    if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error(`Expected a stable semver: ${value}`);
    return value.split('.').map(Number);
  };
  const floor = parse(configured);
  if (!published) return configured;
  const latest = parse(published);
  for (let i = 0; i < 3; i++) {
    if (floor[i] > latest[i]) return configured;
    if (floor[i] < latest[i]) break;
  }
  return `${latest[0]}.${latest[1]}.${latest[2] + 1}`;
}
export async function prepareRelease() {
  const file = 'packages/cli/package.json';
  const pkg = JSON.parse(await readFile(file, 'utf8'));
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok && response.status !== 404)
    throw new Error(`Registry returned ${response.status}; refusing to guess a version.`);
  const metadata = response.status === 404 ? {} : await response.json();
  const commit =
    process.env.GITHUB_SHA ||
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const existing = Object.values(metadata.versions || {}).find((v) => v.gitHead === commit);
  const version = existing?.version || nextVersion(pkg.version, metadata['dist-tags']?.latest);
  pkg.version = version;
  pkg.gitHead = commit;
  await writeFile(file, JSON.stringify(pkg, null, 2) + '\n');
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  lock.packages['packages/cli'].version = version;
  await writeFile('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `version=${version}\npublish=${!existing}\n`);
  console.log(
    `${pkg.name}@${version}: ${existing ? 'already published for this commit' : 'ready to publish'}`,
  );
}
if (process.argv.includes('--run')) await prepareRelease();
