// Offsets are UTF-16 code units, with an exclusive end. No LSP dependencies.
export function checkWord(text, word = '要確認') {
  if (!word) return [];
  const findings = [];
  for (let start = text.indexOf(word); start !== -1; start = text.indexOf(word, start + word.length)) {
    findings.push({ start, end: start + word.length, message: `「${word}」を確認してください（接続検証用）。`, severity: 'information' });
    if (findings.length >= 100) break;
  }
  return findings;
}
