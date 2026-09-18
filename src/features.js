import { toFullwidthAlphanumeric, toHalfwidthAlphanumeric } from './engines/width.js';

// Composition root. The LSP adapter only knows this string-to-string contract.
// Future asynchronous providers may accept an AbortSignal as a second argument.
export const transformations = [
  { id: 'width.full.alphanumeric', title: '英数字を全角に変換', transform: toFullwidthAlphanumeric },
  { id: 'width.half.alphanumeric', title: '英数字を半角に変換', transform: toHalfwidthAlphanumeric },
];
