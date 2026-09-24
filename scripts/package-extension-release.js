// extension-conversion 等を配布用にtar.gz化する。GitHub Releaseに置く「拡張機能本体」の
// アセットを作るためのスクリプト。target/(cargoのビルドキャッシュ、数百MB)は含めない。
// 事前に `cargo build --manifest-path <dir>/Cargo.toml --target wasm32-wasip2 --release --locked`
// で extension.wasm をビルドしておくこと（このスクリプトはビルドしない）。
import { access, mkdir, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTENSION_TARGETS = {
  conversion: { dirName: 'extension-conversion', archiveName: 'writing-tools-conversion-extension' },
  proofreading: { dirName: 'extension-proofreading', archiveName: 'writing-tools-proofreading-extension' },
  translation: { dirName: 'extension-translation', archiveName: 'writing-tools-translation-extension' },
};

const targetName = process.argv[2];
const target = EXTENSION_TARGETS[targetName];
if (!target) {
  throw new Error(`使い方: node scripts/package-extension-release.js <${Object.keys(EXTENSION_TARGETS).join('|')}>`);
}

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const version = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8')).version;
const sourceDir = path.join(projectRoot, target.dirName);
const wasmPath = path.join(sourceDir, 'extension.wasm');

await access(wasmPath).catch(() => {
  throw new Error(
    `${wasmPath} が無い。先に ` +
      `cargo build --manifest-path ${target.dirName}/Cargo.toml --target wasm32-wasip2 --release --locked ` +
      'でビルドすること。',
  );
});

const releaseDir = path.join(projectRoot, 'dist', 'release');
const archiveName = `${target.archiveName}-${version}.tar.gz`;
const archivePath = path.join(releaseDir, archiveName);

await mkdir(releaseDir, { recursive: true });
await rm(archivePath, { force: true });
// target/ (ビルドキャッシュ) だけを除外し、ソース一式(Cargo.toml/Cargo.lock/src/extension.toml/
// LICENSE/THIRD_PARTY_NOTICES)とビルド済み extension.wasm の両方を1本にまとめる。
// LICENSE はリポジトリ直下への相対シンボリックリンクなので、-h で実体化してから収録する
// (そのままだと配布物内でリンク切れになる)。
execFileSync(
  'tar',
  ['-czhf', archivePath, '--exclude=target', '-C', projectRoot, target.dirName],
  { stdio: 'inherit' },
);
console.log(`Packaged release asset: dist/release/${archiveName}`);
