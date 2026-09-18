// textlint（preset-japanese）を使った日本語校正エンジン。
// LSP や Zed 固有の型は扱わず、{ start, end, message } の UTF-16 オフセット配列（終了位置を
// 含まない）を返す。診断への変換・集約・古い結果の破棄は src/lsp/diagnostics.js の責務。
import { loadTextlintrc, createLinter } from 'textlint';
import { moduleInterop } from '@textlint/module-interop';
import presetJapaneseModule from 'textlint-rule-preset-japanese';

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

function buildRules(presetJapanese, { includeHeavy }) {
  return Object.keys(presetJapanese.rules)
    .filter(ruleName => includeHeavy || !HEAVY_RULES.has(ruleName))
    .map(ruleName => ({
      ruleId: `preset-japanese/${ruleName}`,
      rule: presetJapanese.rules[ruleName],
      options: presetJapanese.rulesConfig[ruleName],
    }));
}

let linters;

// サーバー起動後、初回の検査時に一度だけ構築してモジュールスコープでキャッシュする。
// .txt は textlint 標準の @textlint/textlint-plugin-text（loadTextlintrc が設定ファイル無しでも
// 読み込むビルトインプラグイン）で扱えるため、設定ファイルは用意しない。
async function getLinters() {
  if (linters) return linters;
  const baseDescriptor = await loadTextlintrc({});
  const presetJapanese = moduleInterop(presetJapaneseModule);
  const full = createLinter({
    descriptor: baseDescriptor.shallowMerge({ rules: buildRules(presetJapanese, { includeHeavy: true }) }),
  });
  const light = createLinter({
    descriptor: baseDescriptor.shallowMerge({ rules: buildRules(presetJapanese, { includeHeavy: false }) }),
  });
  linters = { full, light };
  return linters;
}

// textlint の message.range は UTF-16 ではなく Unicode コードポイント単位（絵文字を 1 文字と
// 数える）。docs/textlint-research.md で実測確認済み。コードポイント位置 → UTF-16 オフセットの
// 対応表を作って変換する。map[n] は「文書先頭から n コードポイント分進んだ地点」の UTF-16 オフセット。
function buildCodePointToUtf16Map(text) {
  const map = [0];
  let utf16Offset = 0;
  for (const codePoint of text) {
    utf16Offset += codePoint.length;
    map.push(utf16Offset);
  }
  return map;
}

export async function proofread(text) {
  const { full, light } = await getLinters();
  const linter = text.length > MAX_CHARS_FOR_HEAVY_RULES ? light : full;
  const result = await linter.lintText(text, 'input.txt');
  const codePointToUtf16 = buildCodePointToUtf16Map(text);
  return result.messages.map(message => {
    const [start, end] = message.range;
    return {
      start: codePointToUtf16[start],
      end: codePointToUtf16[end],
      message: `${message.message}（${message.ruleId}）`,
    };
  });
}
