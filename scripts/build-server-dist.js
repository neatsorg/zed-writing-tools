import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGETS } from './targets.js';

// サーバー配布物（package.json・ロックファイル・src・本番依存のみの node_modules）を
// dist/<distDirName>/<version>/ に生成する。開発中はここから
// `npm run deploy:server-dev` で Zed 拡張の作業ディレクトリへ配置する。
// 公開後は同じ内容を CI で生成し、リリース資産として GitHub Releases に添付する想定。
//
// 変換拡張と校正拡張は依存が異なる（校正拡張のみ textlint 系を持つ）ため、対象ごとに
// package.json の dependencies を絞り込む（TARGETS は targets.js で定義）。ルートの
// package-lock.json はそのまま使う（npm ci は package.json に無い依存は無視してインストール
// しない。実機で確認済み）。

const targetName = process.argv[2];
const target = TARGETS[targetName];
if (!target) {
  throw new Error(`使い方: node scripts/build-server-dist.js <${Object.keys(TARGETS).join('|')}>`);
}

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const rootPackageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const version = rootPackageJson.version;
const distDir = path.join(projectRoot, 'dist', target.distDirName, version);

// LICENSE ファイルを持たない依存は、package.json の license（SPDX 識別子）から
// scripts/license-texts/ の標準テキストを補う。著作権者プレースホルダー（<year> <owner> など）は
// author／contributors／repository から推定した名前で置換する。標準テキストが用意されていない
// SPDX 識別子（未知のライセンス）は取りこぼしを防ぐためビルドを失敗させる。
const licenseTextsDir = fileURLToPath(new URL('license-texts/', import.meta.url));
const licenseTemplateCache = new Map();

async function loadLicenseTemplate(spdxId) {
  if (licenseTemplateCache.has(spdxId)) return licenseTemplateCache.get(spdxId);
  const template = await readFile(path.join(licenseTextsDir, `${spdxId}.txt`), 'utf8').catch(() => null);
  licenseTemplateCache.set(spdxId, template);
  return template;
}

function extractCopyrightHolder(pkg) {
  const fromPerson = person => {
    if (typeof person === 'string') return person.split('<')[0].split('(')[0].trim();
    if (person && typeof person === 'object' && person.name) return person.name;
    return null;
  };
  const holder = fromPerson(pkg.author) ?? fromPerson(Array.isArray(pkg.contributors) ? pkg.contributors[0] : null);
  if (holder) return holder;
  const repositoryUrl = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const match = repositoryUrl?.match(/github\.com[:/]+([^/]+)\//) ?? repositoryUrl?.match(/^([^/]+)\/[^/]+$/);
  return match?.[1] ?? pkg.name;
}

function fillLicensePlaceholders(template, holder) {
  return template
    .replace(/<year>\s*/gi, '')
    .replace(/\[yyyy\]\s*/gi, '')
    .replace(/<copyright holders>/gi, holder)
    .replace(/<owner>/gi, holder)
    .replace(/\[name of copyright owner\]/gi, holder);
}

// package.json の license は単一の SPDX 識別子（"MIT"）のほか、"(MIT OR CC0-1.0)" のような
// 選択式や、古い形式の licenses 配列（[{ type: "MIT" }]）もある。標準テキストがある最初の
// 識別子を使う。
async function resolveLicenseBySpdxField(pkg) {
  const candidates = pkg.license
    ? pkg.license.match(/[A-Za-z0-9.\-]+/g) ?? []
    : (pkg.licenses ?? []).map(license => license.type).filter(Boolean);
  for (const spdxId of candidates) {
    if (spdxId === 'OR' || spdxId === 'AND') continue;
    const template = await loadLicenseTemplate(spdxId);
    if (template) return fillLicensePlaceholders(template, extractCopyrightHolder(pkg));
  }
  return null;
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

    const licenseText = (await findLicenseFile(packageDir)) ?? (await resolveLicenseBySpdxField(pkg));
    if (!licenseText) {
      throw new Error(
        `${name}（license: ${pkg.license ?? 'unknown'}) の LICENSE ファイルが見つからず、` +
          `標準ライセンス文（scripts/license-texts/）にも該当がありません。テキストを追加してください。`,
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

const distPackageJson = {
  name: `${rootPackageJson.name}-${targetName}`,
  version,
  private: true,
  type: 'module',
  dependencies: Object.fromEntries(
    target.dependencies.map(name => [name, rootPackageJson.dependencies[name]]),
  ),
};
await writeFile(path.join(distDir, 'package.json'), JSON.stringify(distPackageJson, null, 2) + '\n');
await cp(path.join(projectRoot, 'package-lock.json'), path.join(distDir, 'package-lock.json'));
await cp(path.join(projectRoot, 'src'), path.join(distDir, 'src'), { recursive: true });

execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts'], { cwd: distDir, stdio: 'inherit' });

const notices = await buildThirdPartyNotices(path.join(distDir, 'node_modules'));
await writeFile(path.join(distDir, 'THIRD_PARTY_NOTICES'), notices);

console.log(`Built server distribution: dist/${target.distDirName}/${version}/`);
