import { access, cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { TARGETS } from './targets.js';

// dist/<distDirName>/<version>/ を開発用 Zed 拡張の作業ディレクトリへ配置する。
// 拡張本体（extension-conversion/src/lib.rs・extension-proofreading/src/lib.rs）は env::current_dir() で
// この作業ディレクトリを見るため、公開後に GitHub Releases から取得・展開する場所も同じ構成にする。

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

const targetName = process.argv[2];
const target = TARGETS[targetName];
if (!target) {
  throw new Error(`使い方: node scripts/deploy-server-dev.js <${Object.keys(TARGETS).join('|')}>`);
}

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const version = packageJson.version;
const sourceDir = path.join(projectRoot, 'dist', target.distDirName, version);

// コピー元にサーバー本体が無ければ、稼働中の配置には一切触れずに失敗させる。
await access(path.join(sourceDir, target.serverEntry)).catch(() => {
  throw new Error(
    `配布物が見つかりません（${path.join(sourceDir, target.serverEntry)}）。` +
      `先に \`npm run build:server-dist -- ${targetName}\` を実行してください。`,
  );
});

const workDir = path.join(zedExtensionsWorkDir(), target.extensionId);
const distRoot = path.join(workDir, target.distDirName);
const targetDir = path.join(distRoot, version);
const stagingDir = path.join(distRoot, `.staging-${version}`);

await mkdir(distRoot, { recursive: true });
await rm(stagingDir, { recursive: true, force: true }); // 前回失敗時の残骸を掃除
try {
  await cp(sourceDir, stagingDir, { recursive: true });
  // コピーした内容がサーバー本体を含むことを確認できてから、既存版の置き換えに進む。
  await access(path.join(stagingDir, target.serverEntry));
} catch (error) {
  await rm(stagingDir, { recursive: true, force: true });
  throw error;
}

await rm(targetDir, { recursive: true, force: true });
await rename(stagingDir, targetDir);
await writeFile(path.join(distRoot, 'CURRENT_VERSION'), version + '\n');

console.log(`Deployed ${target.distDirName}@${version} to ${targetDir}`);
console.log('Zed で言語サーバーを再起動してください（コマンドパレット: zed: restart language server）。');
