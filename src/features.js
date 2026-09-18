import {
  toFullwidthAlphanumeric, toHalfwidthAlphanumeric,
  toFullwidthAlpha, toHalfwidthAlpha,
  toFullwidthDigit, toHalfwidthDigit,
  toFullwidthSymbol, toHalfwidthSymbol,
  toFullwidthKana, toHalfwidthKana,
} from './engines/width.js';
import { toHiragana, toKatakana } from './engines/kana.js';
import { checkWord } from './engines/check-word.js';

export const inspections = [{ id: 'demo.word', inspect: checkWord }];

// Composition root. The LSP adapter only knows this string-to-string contract.
// Future asynchronous providers may accept an AbortSignal as a second argument.
export const transformations = [
  { id: 'width.full.alphanumeric', title: '英数字を全角に変換', transform: toFullwidthAlphanumeric },
  { id: 'width.half.alphanumeric', title: '英数字を半角に変換', transform: toHalfwidthAlphanumeric },
  { id: 'width.full.alpha', title: '英字を全角に変換', transform: toFullwidthAlpha },
  { id: 'width.half.alpha', title: '英字を半角に変換', transform: toHalfwidthAlpha },
  { id: 'width.full.digit', title: '数字を全角に変換', transform: toFullwidthDigit },
  { id: 'width.half.digit', title: '数字を半角に変換', transform: toHalfwidthDigit },
  { id: 'width.full.symbol', title: '記号を全角に変換', transform: toFullwidthSymbol },
  { id: 'width.half.symbol', title: '記号を半角に変換', transform: toHalfwidthSymbol },
  { id: 'width.full.kana', title: 'カタカナを全角に変換', transform: toFullwidthKana },
  { id: 'width.half.kana', title: 'カタカナを半角に変換', transform: toHalfwidthKana },
  { id: 'kana.hiragana', title: 'カタカナをひらがなに変換', transform: toHiragana },
  { id: 'kana.katakana', title: 'ひらがなをカタカナに変換', transform: toKatakana },
];
