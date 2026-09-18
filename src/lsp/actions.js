export function selectedText(document, range) {
  const start = document.offsetAt(range.start);
  const end = document.offsetAt(range.end);
  // Reject clamped, reversed and empty ranges; no implicit whole-file edits.
  for (const [offset, position] of [[start, range.start], [end, range.end]]) {
    const actual = document.positionAt(offset);
    if (actual.line !== position.line || actual.character !== position.character) return null;
    const text = document.getText();
    if (offset > 0 && /[\uD800-\uDBFF]/.test(text[offset - 1]) && /[\uDC00-\uDFFF]/.test(text[offset] ?? '')) return null;
  }
  return end > start ? document.getText().slice(start, end) : null;
}

export function makeEdit(document, range, newText) {
  return { documentChanges: [{
    textDocument: { uri: document.uri, version: document.version },
    edits: [{ range, newText }],
  }] };
}
