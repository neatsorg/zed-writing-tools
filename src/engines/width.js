// Pure string operations: no editor, protocol, filesystem or network dependency.
import jaconv from 'jaconv';

export function toFullwidthAlphanumeric(text) {
  return text.replace(/[A-Za-z0-9]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
}

export function toHalfwidthAlphanumeric(text) {
  return text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

export function toFullwidthAlpha(text) {
  return text.replace(/[A-Za-z]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
}

export function toHalfwidthAlpha(text) {
  return text.replace(/[Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

export function toFullwidthDigit(text) {
  return text.replace(/[0-9]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
}

export function toHalfwidthDigit(text) {
  return text.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

const halfwidthAlphaDigit = /^[A-Za-z0-9]$/;
const fullwidthAlphaDigit = /^[Ａ-Ｚａ-ｚ０-９]$/;

// jaconv's ASCII table also maps letters, digits and the space character; alphanumerics
// and spaces are excluded here so this stays a punctuation-only conversion independent
// of toFullwidthAlphanumeric, and does not reflow text by changing spacing width.
export function toFullwidthSymbol(text) {
  return Array.from(text).map(c => (halfwidthAlphaDigit.test(c) || c === ' ') ? c : jaconv.toZenAscii(c)).join('');
}

export function toHalfwidthSymbol(text) {
  return Array.from(text).map(c => (fullwidthAlphaDigit.test(c) || c === '　') ? c : jaconv.toHanAscii(c)).join('');
}

// Half-width kana pairs a base character with a combining voiced/semi-voiced mark
// (e.g. ｶ + ﾞ = ガ); jaconv handles that merge, so the whole string is passed through.
export function toFullwidthKana(text) {
  return jaconv.toZenKana(text);
}

export function toHalfwidthKana(text) {
  return jaconv.toHanKana(text);
}
