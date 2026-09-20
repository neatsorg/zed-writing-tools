import { readdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSpdxExpression } from './spdx-expression.js';

// npm 側（scripts/build-server-dist.js）と同様、著作権者を推測しない。プレースホルダーの
// ある標準テキストは、crate 内のファイル・scripts/known-licenses-rust/ で解決できない限り
// 使わない（Apache-2.0・Unicode-3.0・Zlib・Unlicense は著作権者欄が無いテンプレートなので
// そのまま使える。0BSD は著作権者欄があるため crate 内のファイルが必須）。
const licenseTextsDir = fileURLToPath(new URL('license-texts/', import.meta.url));
const knownLicensesRustDir = fileURLToPath(new URL('known-licenses-rust/', import.meta.url));

function hasCopyrightPlaceholder(template) {
  return /<year>|<copyright holders>|<owner>|\[yyyy\]|\[name of copyright owner\]|\bYEAR\b|\bAUTHOR\b/.test(template);
}

async function loadGenericTemplate(spdxId) {
  const text = await readFile(path.join(licenseTextsDir, `${spdxId}.txt`), 'utf8').catch(() => null);
  if (text && !hasCopyrightPlaceholder(text)) return text;
  return null;
}

async function findKnownRustLicense(name, version, spdxId) {
  return readFile(path.join(knownLicensesRustDir, `${name}@${version}-${spdxId}.txt`), 'utf8').catch(() => null);
}

// crate 内の LICENSE ファイル名から SPDX ID を推定するためのトークン。"Apache-2.0 WITH
// LLVM-exception" のような WITH 修飾子付きは、例外名（LLVM-exception 等）をトークンとして使う。
const FILENAME_TOKENS = {
  MIT: ['MIT'],
  'Apache-2.0': ['APACHE'],
  'Unicode-3.0': ['UNICODE'],
  '0BSD': ['0BSD'],
  Unlicense: ['UNLICENSE'],
  Zlib: ['ZLIB'],
};

function filenameTokensFor(spdxId) {
  if (FILENAME_TOKENS[spdxId]) return FILENAME_TOKENS[spdxId];
  const withMatch = spdxId.match(/WITH\s+(.+)$/);
  return [(withMatch ? withMatch[1] : spdxId).replace(/[^A-Za-z0-9]/g, '').toUpperCase()];
}

async function listLicenseFiles(crateDir) {
  const entries = await readdir(crateDir, { withFileTypes: true }).catch(() => []);
  return entries.filter(entry => entry.isFile() && /^licen[cs]e/i.test(entry.name)).map(entry => entry.name);
}

async function findCrateLicenseFile(crateDir, spdxId, licenseFileNames) {
  const tokens = filenameTokensFor(spdxId);
  const normalize = name => name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const matched = licenseFileNames.find(name => tokens.some(token => normalize(name).includes(normalize(token))));
  if (!matched) return null;
  return readFile(path.join(crateDir, matched), 'utf8');
}

// SPDX 式は "(MIT OR Apache-2.0) AND Unicode-3.0" のように AND を含みうる（npm 側には無い）。
// AND の各項は選択ではなく全項目を収録する。OR で選べる場合は Apache-2.0 を優先し
// （GPLv3 との互換性が明確、docs/license-audit.md）、無ければ MIT、それ以外は先頭の識別子。
async function resolveCrateLicenseSections(pkg, crateDir) {
  if (!pkg.license) {
    throw new Error(`${pkg.name}@${pkg.version}: license フィールドが無く、SPDX 式を解析できません。`);
  }
  const andGroups = parseSpdxExpression(pkg.license);
  const licenseFileNames = await listLicenseFiles(crateDir);
  const sections = [];
  for (const orGroup of andGroups) {
    const ordered = [
      ...orGroup.filter(id => id === 'Apache-2.0'),
      ...orGroup.filter(id => id === 'MIT'),
      ...orGroup.filter(id => id !== 'Apache-2.0' && id !== 'MIT'),
    ];
    let resolved = null;
    for (const candidate of ordered) {
      const text =
        (await findCrateLicenseFile(crateDir, candidate, licenseFileNames)) ??
        (await findKnownRustLicense(pkg.name, pkg.version, candidate)) ??
        (await loadGenericTemplate(candidate));
      if (text) { resolved = { spdxId: candidate, text }; break; }
    }
    // 選択肢のいずれにも一致するファイルが無いが、crate に LICENSE ファイルが 1 つだけある場合は、
    // それが該当 OR グループの実体と判断して使う（ファイル名からは SPDX ID を特定できないケース）。
    if (!resolved && licenseFileNames.length === 1) {
      resolved = { spdxId: orGroup.join(' OR '), text: await readFile(path.join(crateDir, licenseFileNames[0]), 'utf8') };
    }
    if (!resolved) {
      throw new Error(
        `${pkg.name}@${pkg.version}: ${orGroup.join(' OR ')} のライセンス全文が見つかりません。` +
          'scripts/known-licenses-rust/ に追加してください。',
      );
    }
    sections.push(resolved);
  }
  return sections;
}

export async function buildRustNotices(manifestPath) {
  const metadataJson = execFileSync(
    'cargo',
    ['metadata', '--manifest-path', manifestPath, '--locked', '--offline', '--format-version', '1'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const metadata = JSON.parse(metadataJson);
  const packages = metadata.packages
    .filter(pkg => pkg.id !== metadata.resolve.root)
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

  const summaryLines = [];
  const licenseSections = [];
  for (const pkg of packages) {
    const crateDir = path.dirname(pkg.manifest_path);
    const repository = typeof pkg.repository === 'string' ? pkg.repository : '';
    summaryLines.push(`- ${pkg.name}@${pkg.version} (${pkg.license ?? 'unknown'}) ${repository}`);
    const sections = await resolveCrateLicenseSections(pkg, crateDir);
    const body = sections.map(section => `### ${section.spdxId}\n\n${section.text.trim()}`).join('\n\n');
    licenseSections.push(`## ${pkg.name}@${pkg.version}\n\n${body}\n`);
  }
  return (
    'Third-Party Notices (Rust dependencies)\n========================================\n\n' +
    'The locked dependency graph includes the following crates (including build and non-target dependencies; this is not a binary composition report). Rust standard-library notices must be supplied separately for a Wasm release.\n\n' +
    summaryLines.join('\n') +
    '\n\n' +
    licenseSections.join('\n')
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [manifestPath, outputPath] = process.argv.slice(2);
  if (!manifestPath) {
    throw new Error('使い方: node scripts/build-rust-notices.js <Cargo.toml のパス> [出力先ファイル]');
  }
  const notices = await buildRustNotices(manifestPath);
  if (outputPath) {
    await writeFile(outputPath, notices);
    console.log(`Wrote ${outputPath}`);
  } else {
    process.stdout.write(notices);
  }
}
