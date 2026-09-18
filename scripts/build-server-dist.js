import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// サーバー配布物（package.json・ロックファイル・src・本番依存のみの node_modules）を
// dist/text-tools-server/<version>/ に生成する。開発中はここから
// `npm run deploy:server-dev` で Zed 拡張の作業ディレクトリへ配置する。
// 公開後は同じ内容を CI で生成し、リリース資産として GitHub Releases に添付する想定。

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const version = packageJson.version;
const distDir = path.join(projectRoot, 'dist', 'text-tools-server', version);

// LICENSE ファイルを持たない既知の依存はここにライセンス全文を明記する。
// 未知の依存は LICENSE ファイル必須とし、無ければビルドを失敗させて取りこぼしを防ぐ。
const KNOWN_LICENSE_TEXTS = {
  'vscode-jsonrpc': microsoftMitLicense(),
  'vscode-languageserver': microsoftMitLicense(),
  'vscode-languageserver-protocol': microsoftMitLicense(),
  'vscode-languageserver-textdocument': microsoftMitLicense(),
  'vscode-languageserver-types': microsoftMitLicense(),
};

function microsoftMitLicense() {
  return `Copyright (c) Microsoft Corporation

All rights reserved.

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;
}

async function findLicenseFile(packageDir) {
  for (const name of ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'License.txt']) {
    try {
      return await readFile(path.join(packageDir, name), 'utf8');
    } catch {
      // 次の候補名を試す
    }
  }
  return null;
}

async function listInstalledPackages(nodeModulesDir) {
  const names = [];
  for (const entry of await readdir(nodeModulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('@')) {
      for (const scoped of await readdir(path.join(nodeModulesDir, entry.name), { withFileTypes: true })) {
        if (scoped.isDirectory()) names.push(`${entry.name}/${scoped.name}`);
      }
      continue;
    }
    if (entry.name.startsWith('.')) continue;
    names.push(entry.name);
  }
  return names.sort();
}

async function buildThirdPartyNotices(nodeModulesDir) {
  const names = await listInstalledPackages(nodeModulesDir);
  const summaryLines = [];
  const licenseSections = [];
  for (const name of names) {
    const packageDir = path.join(nodeModulesDir, name);
    const pkg = JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8'));
    const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? '';
    summaryLines.push(`- ${pkg.name}@${pkg.version} (${pkg.license ?? 'unknown'}) ${repository}`);

    const licenseText = (await findLicenseFile(packageDir)) ?? KNOWN_LICENSE_TEXTS[name];
    if (!licenseText) {
      throw new Error(
        `${name} の LICENSE ファイルが見つからず、既知のライセンス文にも登録されていません。` +
          'scripts/build-server-dist.js の KNOWN_LICENSE_TEXTS に追加してください。',
      );
    }
    licenseSections.push(`## ${pkg.name}@${pkg.version}\n\n${licenseText.trim()}\n`);
  }
  return (
    'Third-Party Notices\n====================\n\n' +
    'This distribution bundles the following third-party packages:\n\n' +
    summaryLines.join('\n') +
    '\n\n' +
    licenseSections.join('\n')
  );
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await cp(path.join(projectRoot, 'package.json'), path.join(distDir, 'package.json'));
await cp(path.join(projectRoot, 'package-lock.json'), path.join(distDir, 'package-lock.json'));
await cp(path.join(projectRoot, 'src'), path.join(distDir, 'src'), { recursive: true });

execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts'], { cwd: distDir, stdio: 'inherit' });

const notices = await buildThirdPartyNotices(path.join(distDir, 'node_modules'));
await writeFile(path.join(distDir, 'THIRD_PARTY_NOTICES'), notices);

console.log(`Built server distribution: dist/text-tools-server/${version}/`);
