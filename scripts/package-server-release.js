import { mkdir, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGETS } from './targets.js';

const targetName = process.argv[2];
const target = TARGETS[targetName];
if (!target) {
  throw new Error(`使い方: node scripts/package-server-release.js <${Object.keys(TARGETS).join('|')}>`);
}

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const version = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8')).version;
const sourceDir = path.join(projectRoot, 'dist', target.distDirName, version);
const releaseDir = path.join(projectRoot, 'dist', 'release');
const archiveName = `${target.distDirName}-${version}.tar.gz`;
const archivePath = path.join(releaseDir, archiveName);

await mkdir(releaseDir, { recursive: true });
await rm(archivePath, { force: true });
execFileSync('tar', ['-czf', archivePath, '-C', sourceDir, '.'], { stdio: 'inherit' });
console.log(`Packaged release asset: dist/release/${archiveName}`);
