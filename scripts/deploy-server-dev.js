import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// dist/text-tools-server/<version>/ を開発用 Zed 拡張の作業ディレクトリへ配置する。
// 拡張本体（extension/src/lib.rs）は env::current_dir() でこの作業ディレクトリを見るため、
// 公開後に GitHub Releases から取得・展開する場所も同じ構成にする。

const EXTENSION_ID = 'text-tools';
const SERVER_DIST_DIR = 'text-tools-server';

function zedExtensionsWorkDir() {
  const platform = os.platform();
  if (platform === 'linux') {
    const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    return path.join(dataHome, 'zed', 'extensions', 'work');
  }
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Zed', 'extensions', 'work');
  }
  throw new Error(
    `未対応の OS です（${platform}）。Zed の拡張作業ディレクトリを確認し、` +
      'このスクリプトの zedExtensionsWorkDir() に追加してください。',
  );
}

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const version = packageJson.version;
const sourceDir = path.join(projectRoot, 'dist', SERVER_DIST_DIR, version);

const workDir = path.join(zedExtensionsWorkDir(), EXTENSION_ID);
const targetDir = path.join(workDir, SERVER_DIST_DIR, version);

await mkdir(workDir, { recursive: true });
await rm(targetDir, { recursive: true, force: true });
await cp(sourceDir, targetDir, { recursive: true });
await writeFile(path.join(workDir, SERVER_DIST_DIR, 'CURRENT_VERSION'), version + '\n');

console.log(`Deployed text-tools-server@${version} to ${targetDir}`);
console.log('Zed で言語サーバーを再起動してください（コマンドパレット: zed: restart language server）。');
