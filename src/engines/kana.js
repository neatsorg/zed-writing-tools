// Pure string operations: no editor, protocol, filesystem or network dependency.
import jaconv from 'jaconv';

export function toHiragana(text) {
  return jaconv.toHiragana(text);
}

export function toKatakana(text) {
  return jaconv.toKatakana(text);
}
