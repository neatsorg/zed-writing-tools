// DeepL API による翻訳エンジン。LSP や Zed 固有の型は扱わず、文字列を受け取り文字列を返す。
// 通信・認証・エラー分類をここに閉じ、呼び出し側（src/lsp/create-server.js）は
// この契約（translate(text, targetLang, signal)）だけを知る。
//
// セキュリティ上の方針（ユーザー要求）:
// - APIキーは process.env.DEEPL_AUTH_KEY を呼び出しのたびに読む（インポート時に固定しない）。
//   .zed/settings.json 等の設定ファイルには一切書かせない。
// - 送信先 URL は固定（キー形式から Free/Pro を自動判定）。設定で変更できるようにしない。
// - 原文・訳文・キーをログに出さない。エラーメッセージに含めるのは HTTP ステータスと kind のみ。
//
// 1Password CLI（op）連携（任意）: DEEPL_AUTH_KEY の代わりに DEEPL_AUTH_KEY_OP_REF
// （"op://vault/item/field" という参照文字列。これ自体は秘密ではない）を設定すると、
// 実際に翻訳を実行した瞬間に初めて `op read` でキーを解決する。エディタ起動時に無条件で
// 1Password の認証を求めると体験が悪いため（未使用でも毎回認証が走ってしまう）、
// 解決は使用時まで遅延させ、成功したらこのプロセスの寿命の間だけメモリに保持して使い回す
// （キーそのものは他のどこにも書き出さない）。

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// DeepL のテキスト翻訳はリクエスト全体で 128KiB の上限がある。JSON のオーバーヘッド分を見込み、
// 安全マージンを取った値。呼び出し側はこれを超えるテキストを送信前に拒否する（このモジュールは呼ばない）。
export const MAX_TEXT_BYTES = 100_000;

const REQUEST_TIMEOUT_MS = 15_000;
const OP_READ_TIMEOUT_MS = 60_000; // 1Password 側のユーザー操作（生体認証等）を待てる猶予。

export class DeeplTranslationError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'DeeplTranslationError';
    this.kind = kind;
  }
}

let cachedOpResolvedKey = null;

async function resolveApiKey(signal) {
  if (process.env.DEEPL_AUTH_KEY) return process.env.DEEPL_AUTH_KEY;
  if (cachedOpResolvedKey) return cachedOpResolvedKey;

  const opRef = process.env.DEEPL_AUTH_KEY_OP_REF;
  if (!opRef) {
    throw new DeeplTranslationError(
      'missing-key',
      'DEEPL_AUTH_KEY（または DEEPL_AUTH_KEY_OP_REF）が設定されていません。',
    );
  }
  let stdout;
  try {
    ({ stdout } = await execFileAsync('op', ['read', opRef], { timeout: OP_READ_TIMEOUT_MS, signal }));
  } catch (error) {
    if (signal?.aborted) throw new DeeplTranslationError('cancelled', 'キャンセルされました。');
    throw new DeeplTranslationError(
      'op-resolve-failed',
      '1Password（op）からのキー取得に失敗しました。op コマンドが利用可能か、' +
        '認証済みか、参照先が正しいかを確認してください。',
    );
  }
  const key = stdout.trim();
  if (!key) {
    throw new DeeplTranslationError('op-resolve-failed', '1Password（op）の参照先が空でした。');
  }
  cachedOpResolvedKey = key;
  return key;
}

function endpointFor(apiKey) {
  // DeepL の慣例: Free プランのキーは ":fx" で終わる。
  return apiKey.endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
}

function classifyStatus(status) {
  if (status === 403) return 'auth';
  if (status === 456) return 'quota';
  if (status === 429 || status === 529) return 'rate-limit';
  if (status === 413) return 'too-large';
  return 'unknown';
}

export async function translate(text, targetLang, signal) {
  const apiKey = await resolveApiKey(signal);

  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  let response;
  try {
    response = await fetch(endpointFor(apiKey), {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: [text], target_lang: targetLang }),
      signal: combinedSignal,
    });
  } catch (error) {
    if (signal?.aborted) throw new DeeplTranslationError('cancelled', 'キャンセルされました。');
    if (timeoutSignal.aborted) throw new DeeplTranslationError('timeout', 'DeepL への通信がタイムアウトしました。');
    throw new DeeplTranslationError('network', 'DeepL への通信に失敗しました。');
  }

  if (!response.ok) {
    throw new DeeplTranslationError(classifyStatus(response.status), `DeepL がエラーを返しました（status: ${response.status}）。`);
  }

  const body = await response.json();
  const translated = body.translations?.[0]?.text;
  if (typeof translated !== 'string') {
    throw new DeeplTranslationError('unknown', 'DeepL の応答を解釈できませんでした。');
  }
  return translated;
}
