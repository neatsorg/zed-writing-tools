// textlint（preset-japanese）を使った日本語校正エンジン。
// LSP や Zed 固有の型は扱わず、{ start, end, message } の UTF-16 オフセット配列（終了位置を
// 含まない）を返す。診断への変換・集約・古い結果の破棄は src/lsp/diagnostics.js の責務。
import { createLinter } from 'textlint';
import { TextlintKernelDescriptor } from '@textlint/kernel';
import { moduleInterop } from '@textlint/module-interop';
import textlintPluginTextModule from '@textlint/textlint-plugin-text';
import presetJapaneseModule from 'textlint-rule-preset-japanese';

const presetJapanese = moduleInterop(presetJapaneseModule);
const textlintPluginText = moduleInterop(textlintPluginTextModule);
const ALL_RULE_NAMES = Object.keys(presetJapanese.rules);

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

// kuromoji などの形態素解析・言語解析ライブラリを使うルール。これらは対象トークンの相対位置
// （kuromoji の word_position など）を Unicode コードポイント単位で計算しており、それが
// textlint 本体（UTF-16 単位でノード位置を計算する）に UTF-16 オフセットとしてそのまま加算される
// ため、絵文字（サロゲートペア）を含む文書では絶対位置がズレる（docs/textlint-research.md 参照）。
// ノード境界の再現には textlint 内部の文分割ロジックが必要で、外部から正確に補正するのは
// 現実的ではないため、サロゲートペアを含む文書ではこれらのルールをスキップする。
const MORPHOLOGICAL_RULES = new Set([
  'max-ten',
  'no-doubled-conjunctive-particle-ga',
  'no-doubled-conjunction',
  'no-doubled-joshi',
  'no-double-negative-ja',
  'no-dropping-the-ra',
  'no-mix-dearu-desumasu',
]);

const SURROGATE_PAIR_PATTERN = /[\uD800-\uDBFF][\uDC00-\uDFFF]/;

function selectRuleNames(text) {
  const withinSizeCap = text.length <= MAX_CHARS_FOR_HEAVY_RULES;
  const hasSurrogatePair = SURROGATE_PAIR_PATTERN.test(text);
  return ALL_RULE_NAMES.filter(
    name => (withinSizeCap || !HEAVY_RULES.has(name)) && (!hasSurrogatePair || !MORPHOLOGICAL_RULES.has(name)),
  );
}

function buildRules(ruleNames) {
  return ruleNames.map(ruleName => ({
    ruleId: `preset-japanese/${ruleName}`,
    rule: presetJapanese.rules[ruleName],
    options: presetJapanese.rulesConfig[ruleName],
  }));
}

// プロジェクトの .textlintrc 等は探索しない。textlint パッケージが公開する API
// （createLinter・loadTextlintrc）だけでは設定ファイル探索を避けられないため、
// @textlint/kernel の TextlintKernelDescriptor を直接構築する。LSP サーバーの作業ディレクトリは
// 開いているプロジェクトのルートになりうるため、設定探索を経由するとそこにある textlintrc の
// ルール・フィルターが意図せず混入する。.txt に必要な @textlint/textlint-plugin-text は
// 常に明示的に含める。
function buildDescriptor(ruleNames) {
  return new TextlintKernelDescriptor({
    rules: buildRules(ruleNames),
    filterRules: [],
    plugins: [{ pluginId: '@textlint/textlint-plugin-text', plugin: textlintPluginText, options: true }],
  });
}

// ルール集合ごとに（サーバー起動後、初回の検査時に）一度だけ構築してキャッシュする。
const lintersByRuleNamesKey = new Map();
function getLinterFor(ruleNames) {
  const key = ruleNames.join(',');
  const cached = lintersByRuleNamesKey.get(key);
  if (cached) return cached;
  const linter = createLinter({ descriptor: buildDescriptor(ruleNames) });
  lintersByRuleNamesKey.set(key, linter);
  return linter;
}

// textlint の message.range は、多くのルール（正規表現ベース）では textlint 本体と同じ
// UTF-16 コードユニット単位だが、形態素解析系ルールは絵文字を含むとズレる（上記参照）。
// そのため変換はせず、range をそのまま UTF-16 オフセットとして使う。
export async function proofread(text) {
  const linter = getLinterFor(selectRuleNames(text));
  const result = await linter.lintText(text, 'input.txt');
  return result.messages.map(message => {
    const [start, end] = message.range;
    return { start, end, message: `${message.message}（${message.ruleId}）` };
  });
}
