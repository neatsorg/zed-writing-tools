import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchKuromoji } from './patch-kuromoji.js';
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

// 著作権者を author／リポジトリ所有者から推測しない（不正確になりうる。例:
// imurmurhash の author は Jens Taylor のみだが、実際の著作権表示は Gary Court・Jens Taylor の
// 連名。docs/license-audit.md 参照）。テンプレートに著作権者プレースホルダーが無い
// ライセンス（Apache-2.0・CC0-1.0・WTFPL・BlueOak-1.0.0・Python-2.0・CC-BY-3.0）はそのまま使うが、
// プレースホルダーがあるライセンス（MIT・BSD-2/3-Clause・ISC 等）は
// scripts/known-licenses/（個別に確認済みの全文）で解決できない限りビルドを失敗させる。
function hasCopyrightPlaceholder(template) {
  return /<year>|<copyright holders>|<owner>|\[yyyy\]|\[name of copyright owner\]/i.test(template);
}

// package.json の license は単一の SPDX 識別子（"MIT"）のほか、"(MIT OR CC0-1.0)" のような
// 選択式や、古い形式の licenses 配列（[{ type: "MIT" }]）もある。"AND"（両方の条件を満たす
// 必要がある）は最初の識別子だけを採用する簡略化をせず、複合条件として個別確認を要求する。
async function resolveLicenseBySpdxField(pkg) {
  const raw = pkg.license ?? '';
  if (/\bAND\b/.test(raw)) {
    throw new Error(
      `${pkg.name}@${pkg.version}: ライセンス式に AND が含まれます（${raw}）。` +
        '複数条件をすべて満たす必要があるため、個別に確認してください。',
    );
  }
  const candidates = raw
    ? raw.match(/[A-Za-z0-9.\-]+/g) ?? []
    : (pkg.licenses ?? []).map(license => license.type).filter(Boolean);
  for (const spdxId of candidates) {
    if (spdxId === 'OR') continue;
    const template = await loadLicenseTemplate(spdxId);
    if (template && !hasCopyrightPlaceholder(template)) return template;
  }
  return null;
}

async function findNoticeFile(packageDir) {
  const entries = await readdir(packageDir, { withFileTypes: true }).catch(() => []);
  const candidate = entries.find(entry => entry.isFile() && /^notice(\.|$)/i.test(entry.name));
  if (!candidate) return null;
  return readFile(path.join(packageDir, candidate.name), 'utf8').catch(() => null);
}

// LICENSE・LICENCE の大小文字・拡張子違い（kuromoji の LICENSE-2.0.txt 等）を広く受け付ける。
// 完全一致する名前を優先する。
async function findLicenseFile(packageDir) {
  const entries = await readdir(packageDir, { withFileTypes: true }).catch(() => []);
  const candidates = entries
    .filter(entry => entry.isFile() && /^licen[cs]e/i.test(entry.name))
    .sort((a, b) => {
      const rank = name => (/^licen[cs]e$/i.test(name) ? 0 : /^licen[cs]e\.(txt|md)$/i.test(name) ? 1 : 2);
      return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
    });
  for (const candidate of candidates) {
    const text = await readFile(path.join(packageDir, candidate.name), 'utf8').catch(() => null);
    if (text) return text;
  }
  return null;
}

// LICENSE 系ファイルが無いパッケージでも、README にライセンス全文が埋め込まれていることがある
// （imurmurhash・lru_map 等）。MIT の特徴的な文言を境界に抽出する。
const MIT_FULLTEXT_PATTERN =
  /Copyright[\s\S]{0,2000}?Permission is hereby granted[\s\S]{0,4000}?(?:DEALINGS IN THE SOFTWARE|OTHER DEALINGS IN THE SOFTWARE)\.?/i;

async function findLicenseInReadme(packageDir) {
  for (const name of ['README.md', 'readme.md', 'Readme.md', 'README', 'README.markdown']) {
    const text = await readFile(path.join(packageDir, name), 'utf8').catch(() => null);
    if (!text) continue;
    const match = text.match(MIT_FULLTEXT_PATTERN);
    if (match) return match[0].trim();
  }
  return null;
}

// LICENSE ファイル・README 全文検出のどちらでも見つからないパッケージのうち、著作権者欄が
// 必要なライセンスについては、個別に確認済みの全文を scripts/known-licenses/ に置く
// （README.md にファイルごとの出典を記録）。
const knownLicensesDir = fileURLToPath(new URL('known-licenses/', import.meta.url));
async function findKnownLicense(packageName) {
  const fileName = packageName.includes('/') ? packageName.split('/')[1] : packageName;
  return readFile(path.join(knownLicensesDir, `${fileName}.txt`), 'utf8').catch(() => null);
}

// 直下だけでなく、バージョン競合で作られる入れ子の node_modules も再帰的に列挙する。
// 同じ name@version が複数箇所にあれば最初に見つかったものを使う（内容は同一のはず）。
async function listInstalledPackages(nodeModulesDir) {
  const packageDirsByKey = new Map();
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '.bin' || entry.name.startsWith('.')) continue;
      if (entry.name.startsWith('@')) {
        await walk(path.join(dir, entry.name));
        continue;
      }
      const packageDir = path.join(dir, entry.name);
      const pkg = await readFile(path.join(packageDir, 'package.json'), 'utf8')
        .then(JSON.parse)
        .catch(() => null);
      if (pkg) {
        const key = `${pkg.name}@${pkg.version}`;
        if (!packageDirsByKey.has(key)) packageDirsByKey.set(key, packageDir);
      }
      await walk(path.join(packageDir, 'node_modules'));
    }
  }
  await walk(nodeModulesDir);
  return [...packageDirsByKey.keys()].sort().map(key => packageDirsByKey.get(key));
}

async function buildThirdPartyNotices(nodeModulesDir) {
  const packageDirs = await listInstalledPackages(nodeModulesDir);
  const summaryLines = [];
  const licenseSections = [];
  for (const packageDir of packageDirs) {
    const pkg = JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8'));
    const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? '';
    summaryLines.push(`- ${pkg.name}@${pkg.version} (${pkg.license ?? 'unknown'}) ${repository}`);

    const licenseText =
      (await findLicenseFile(packageDir)) ??
      (await findLicenseInReadme(packageDir)) ??
      (await findKnownLicense(pkg.name)) ??
      (await resolveLicenseBySpdxField(pkg));
    if (!licenseText) {
      throw new Error(
        `${pkg.name}@${pkg.version}（license: ${pkg.license ?? 'unknown'}）のライセンス全文が` +
          '見つかりません。LICENSE ファイル・README・scripts/known-licenses/ のいずれにも該当が' +
          'ないため、著作権者を推測せずビルドを失敗させています。個別に確認して' +
          'scripts/known-licenses/ に追加してください。',
      );
    }
    let section = `## ${pkg.name}@${pkg.version}\n\n${licenseText.trim()}\n`;
    const noticeText = await findNoticeFile(packageDir);
    // NOTICE ファイルは Apache-2.0 の追加帰属表示のこともあれば（kuromoji の場合）、
    // 本体とは別ライセンス条件の同梱データ（mecab-ipadic、NAIST-2003 相当）を指すこともある。
    // 上の本体ライセンスと同一視されないよう見出しで明示する（docs/license-audit.md 参照）。
    if (noticeText) {
      section += `\n### NOTICE（同梱データ等への追加条件の可能性、本体ライセンスとは別に保持）\n\n${noticeText.trim()}\n`;
    }
    licenseSections.push(section);
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
  license: rootPackageJson.license,
  type: 'module',
  dependencies: Object.fromEntries(
    target.dependencies.map(name => [name, rootPackageJson.dependencies[name]]),
  ),
};
await writeFile(path.join(distDir, 'package.json'), JSON.stringify(distPackageJson, null, 2) + '\n');
// README の著作権・GPL-3.0-or-later 適用表示と GPL 本文を配布物にも保持する。
await cp(path.join(projectRoot, 'LICENSE'), path.join(distDir, 'LICENSE'));
await cp(path.join(projectRoot, 'README.md'), path.join(distDir, 'README.md'));
await cp(path.join(projectRoot, 'package-lock.json'), path.join(distDir, 'package-lock.json'));
await cp(path.join(projectRoot, 'src'), path.join(distDir, 'src'), { recursive: true });

execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts'], { cwd: distDir, stdio: 'inherit' });

if (targetName === 'proofreading') {
  await patchKuromoji(distDir);
  await cp(path.join(projectRoot, 'patches'), path.join(distDir, 'patches'), { recursive: true });
}

const notices = await buildThirdPartyNotices(path.join(distDir, 'node_modules'));
await writeFile(path.join(distDir, 'THIRD_PARTY_NOTICES'), notices);

console.log(`Built server distribution: dist/${target.distDirName}/${version}/`);
