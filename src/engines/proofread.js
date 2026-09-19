// textlint（preset-japanese）を使った日本語校正エンジン。
// LSP や Zed 固有の型は扱わず、{ start, end, message } の UTF-16 オフセット配列（終了位置を
// 含まない）を返す。診断への変換・集約・古い結果の破棄は src/lsp/diagnostics.js の責務。
import { createRequire } from 'node:module';
import { TextlintKernel, TextlintKernelDescriptor } from '@textlint/kernel';
import { moduleInterop } from '@textlint/module-interop';
import textlintPluginTextModule from '@textlint/textlint-plugin-text';
import presetJapaneseModule from 'textlint-rule-preset-japanese';

// Direct node launches must not silently use an unpatched installation after --ignore-scripts.
const require = createRequire(import.meta.url);
if (require('kuromoji/src/Tokenizer.js').textToolsUtf16Patch !== 1 ||
    require('kuromoji/src/viterbi/ViterbiBuilder.js').textToolsUtf16Patch !== 1) {
  throw new Error('Run npm run patch:deps before starting the proofreading server.');
}

const presetJapanese = moduleInterop(presetJapaneseModule);
const textlintPluginText = moduleInterop(textlintPluginTextModule);
export const ALL_RULE_NAMES = Object.keys(presetJapanese.rules);

// 文単位で解析するため、文書サイズに対して超線形に遅くなるルール（検証結果は
// docs/textlint-research.md）。この文字数を超える文書ではスキップする。
const HEAVY_RULES = new Set([
  'max-ten',
  'no-doubled-conjunctive-particle-ga',
  'no-doubled-conjunction',
  'no-doubled-joshi',
  'sentence-length',
]);
const MAX_CHARS_FOR_HEAVY_RULES = 30000;

function selectRuleNames(text, disabledRuleNames) {
  return ALL_RULE_NAMES.filter(name =>
    !disabledRuleNames.has(name) && (text.length <= MAX_CHARS_FOR_HEAVY_RULES || !HEAVY_RULES.has(name)));
}

function buildRules(ruleNames) {
  return ruleNames.map(ruleName => ({
    ruleId: `preset-japanese/${ruleName}`,
    rule: presetJapanese.rules[ruleName],
    options: presetJapanese.rulesConfig[ruleName],
  }));
}

// プロジェクトの .textlintrc 等は探索しない。textlint パッケージの高水準 API
// （createLinter・loadTextlintrc）はいずれも設定ファイル探索、または探索を行う
// ライブラリ群（read-package-up 経由で spdx-exceptions（CC-BY-3.0）まで連なる。
// docs/license-audit.md）を配布物に持ち込むため使わない。@textlint/kernel の
// TextlintKernel／TextlintKernelDescriptor を直接使い、textlint パッケージ自体への
// 依存を持たない。LSP サーバーの作業ディレクトリは開いているプロジェクトのルートに
// なりうるため、設定探索を経由するとそこにある textlintrc のルール・フィルターが
// 意図せず混入する。.txt に必要な @textlint/textlint-plugin-text は常に明示的に含める。
const kernel = new TextlintKernel();

function buildKernelOptions(ruleNames) {
  const descriptor = new TextlintKernelDescriptor({
    rules: buildRules(ruleNames),
    filterRules: [],
    plugins: [{ pluginId: '@textlint/textlint-plugin-text', plugin: textlintPluginText, options: true }],
  });
  return { ext: '.txt', filePath: 'input.txt', ...descriptor.toKernelOptions() };
}

// ルール集合ごとに（サーバー起動後、初回の検査時に）一度だけ構築してキャッシュする。
const kernelOptionsByRuleNamesKey = new Map();
function getKernelOptionsFor(ruleNames) {
  const key = ruleNames.join(',');
  const cached = kernelOptionsByRuleNamesKey.get(key);
  if (cached) return cached;
  const options = buildKernelOptions(ruleNames);
  kernelOptionsByRuleNamesKey.set(key, options);
  return options;
}

// kuromoji の位置補正は依存パッチで行う。textlint の range は UTF-16 のまま返す。
// disabledRuleNames（preset-japanese のルール名の集合）で指定したルールは、診断からの除外では
// なくカーネルへ渡すルール自体から外す。無効化は表示だけでなく実行そのものを止める。
export async function proofread(text, signal, { disabledRuleNames = new Set() } = {}) {
  const result = await kernel.lintText(text, getKernelOptionsFor(selectRuleNames(text, disabledRuleNames)));
  return result.messages.map(message => {
    const [start, end] = message.range;
    return { start, end, message: `${message.message}（${message.ruleId}）` };
  });
}
