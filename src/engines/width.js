// Pure string operations: no editor, protocol, filesystem or network dependency.
export function toFullwidthAlphanumeric(text) {
  return text.replace(/[A-Za-z0-9]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
}

export function toHalfwidthAlphanumeric(text) {
  return text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}
