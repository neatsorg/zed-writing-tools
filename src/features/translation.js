import { translate, MAX_TEXT_BYTES } from '../engines/deepl.js';

// Composition root for the translation extension. The LSP adapter (create-server.js) only knows
// this contract: { id, title, translate(text, signal), maxTextBytes }. It must not import
// src/engines/deepl.js directly, so translation-specific limits (maxTextBytes) travel with each
// provider instead. Must not import the conversion/proofreading engines.
//
// DeepL の target_lang は "EN" 単体では無効で、EN-US/EN-GB のいずれかが必須。
// 初版は EN-US を採用する（ユーザー確認済み。将来必要になれば設定化する）。
export const translations = [
  { id: 'deepl.ja', title: 'DeepLで日本語に翻訳', maxTextBytes: MAX_TEXT_BYTES, translate: (text, signal) => translate(text, 'JA', signal) },
  { id: 'deepl.en', title: 'DeepLで英語に翻訳', maxTextBytes: MAX_TEXT_BYTES, translate: (text, signal) => translate(text, 'EN-US', signal) },
];
