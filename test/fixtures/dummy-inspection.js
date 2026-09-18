// E2E テスト専用のダミー検査エンジン。本格校正エンジン（textlint 接続）に
// 置き換わるまでの間、diagnostics.js の接続（変換との両立、古い結果の破棄、
// 診断の消去）を検証するためだけに使う。製品コード（src/）には置かない。
const WORD = '要確認';

export function dummyInspect(text) {
  const findings = [];
  for (let start = text.indexOf(WORD); start !== -1; start = text.indexOf(WORD, start + WORD.length)) {
    findings.push({ start, end: start + WORD.length, message: `「${WORD}」を確認してください（テスト用）。` });
  }
  return findings;
}
