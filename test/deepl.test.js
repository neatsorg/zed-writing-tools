import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile as writeFileText, chmod, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { translate, MAX_TEXT_BYTES, DeeplTranslationError } from '../src/engines/deepl.js';

function stubFetch(t, handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  t.after(() => { globalThis.fetch = original; });
  return calls;
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// DEEPL_AUTH_KEY_OP_REF まわりのテスト用: PATH 上に偽の `op` 実行可能ファイルを置く。
// 本物の 1Password CLI を要求せず、execFile('op', ...) が subprocess として呼ばれることだけを
// ブラックボックスに検証する（呼び出し回数はファイルへの追記で数える）。
async function createFakeOp(t, { exitCode = 0, output = '' } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'fake-op-'));
  const counterFile = path.join(dir, 'calls.txt');
  const script = exitCode === 0
    ? `#!/bin/sh\necho called >> "${counterFile}"\nprintf '%s' '${output}'\n`
    : `#!/bin/sh\necho called >> "${counterFile}"\nexit ${exitCode}\n`;
  const opPath = path.join(dir, 'op');
  await writeFileText(opPath, script);
  await chmod(opPath, 0o755);
  const originalPath = process.env.PATH;
  process.env.PATH = `${dir}:${originalPath}`;
  t.after(() => { process.env.PATH = originalPath; });
  return {
    async callCount() {
      const text = await readFile(counterFile, 'utf8').catch(() => '');
      return text.split('\n').filter(Boolean).length;
    },
  };
}

let importCounter = 0;
// resolveApiKey のキャッシュはモジュールのトップレベル変数なので、キャッシュ挙動に関わる
// テストは動的 import に一意なクエリを付けて毎回フレッシュなモジュールインスタンスを使う
// （src/engines/deepl.js 自体にテスト専用のリセット用フックは追加しない）。
function importFreshDeepl() {
  importCounter += 1;
  return import(`../src/engines/deepl.js?test-case=${importCounter}`);
}

test('translate sends the auth header, target_lang and omits source_lang for auto-detect', async t => {
  process.env.DEEPL_AUTH_KEY = 'test-key:fx';
  t.after(() => { delete process.env.DEEPL_AUTH_KEY; });
  const calls = stubFetch(t, () => jsonResponse(200, { translations: [{ text: '翻訳結果' }] }));

  const result = await translate('hello', 'JA');

  assert.equal(result, '翻訳結果');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api-free.deepl.com/v2/translate');
  assert.equal(calls[0].init.headers['Authorization'], 'DeepL-Auth-Key test-key:fx');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body, { text: ['hello'], target_lang: 'JA' });
  assert.equal('source_lang' in body, false);
});

test('translate selects the Pro endpoint for keys without the :fx suffix', async t => {
  process.env.DEEPL_AUTH_KEY = 'pro-key';
  t.after(() => { delete process.env.DEEPL_AUTH_KEY; });
  const calls = stubFetch(t, () => jsonResponse(200, { translations: [{ text: 'x' }] }));

  await translate('hello', 'EN-US');

  assert.equal(calls[0].url, 'https://api.deepl.com/v2/translate');
});

test('translate rejects with a missing-key error and never calls fetch', async t => {
  // 開発者の実環境で DEEPL_AUTH_KEY_OP_REF がすでに設定されていても再現できるよう、
  // 両方の環境変数を明示的に消してからテストする。
  delete process.env.DEEPL_AUTH_KEY;
  delete process.env.DEEPL_AUTH_KEY_OP_REF;
  const calls = stubFetch(t, () => { throw new Error('must not be called'); });

  await assert.rejects(translate('hello', 'JA'), error => {
    assert.ok(error instanceof DeeplTranslationError);
    assert.equal(error.kind, 'missing-key');
    return true;
  });
  assert.equal(calls.length, 0);
});

for (const [status, kind] of [[403, 'auth'], [456, 'quota'], [429, 'rate-limit'], [529, 'rate-limit'], [413, 'too-large'], [500, 'unknown']]) {
  test(`translate classifies HTTP ${status} as kind "${kind}"`, async t => {
    process.env.DEEPL_AUTH_KEY = 'test-key:fx';
    t.after(() => { delete process.env.DEEPL_AUTH_KEY; });
    stubFetch(t, () => jsonResponse(status, {}));

    await assert.rejects(translate('hello', 'JA'), error => {
      assert.ok(error instanceof DeeplTranslationError);
      assert.equal(error.kind, kind);
      return true;
    });
  });
}

test('translate classifies a network failure as kind "network"', async t => {
  process.env.DEEPL_AUTH_KEY = 'test-key:fx';
  t.after(() => { delete process.env.DEEPL_AUTH_KEY; });
  stubFetch(t, () => { throw new Error('getaddrinfo ENOTFOUND'); });

  await assert.rejects(translate('hello', 'JA'), error => {
    assert.ok(error instanceof DeeplTranslationError);
    assert.equal(error.kind, 'network');
    return true;
  });
});

test('translate classifies caller cancellation as kind "cancelled"', async t => {
  process.env.DEEPL_AUTH_KEY = 'test-key:fx';
  t.after(() => { delete process.env.DEEPL_AUTH_KEY; });
  const controller = new AbortController();
  stubFetch(t, () => { controller.abort(); const error = new Error('aborted'); error.name = 'AbortError'; throw error; });

  await assert.rejects(translate('hello', 'JA', controller.signal), error => {
    assert.ok(error instanceof DeeplTranslationError);
    assert.equal(error.kind, 'cancelled');
    return true;
  });
});

test('MAX_TEXT_BYTES leaves headroom under the DeepL 128KiB request limit', () => {
  assert.ok(MAX_TEXT_BYTES < 128 * 1024);
});

test('translate does not log the API key or the text', async t => {
  process.env.DEEPL_AUTH_KEY = 'super-secret-key:fx';
  t.after(() => { delete process.env.DEEPL_AUTH_KEY; });
  stubFetch(t, () => jsonResponse(200, { translations: [{ text: '訳文' }] }));
  const originalLog = console.log;
  const originalError = console.error;
  const logged = [];
  console.log = (...args) => logged.push(args);
  console.error = (...args) => logged.push(args);
  t.after(() => { console.log = originalLog; console.error = originalError; });

  await translate('confidential source text', 'JA');

  assert.equal(logged.length, 0);
});

test('translate resolves the key via `op read` when only DEEPL_AUTH_KEY_OP_REF is set', async t => {
  delete process.env.DEEPL_AUTH_KEY;
  process.env.DEEPL_AUTH_KEY_OP_REF = 'op://Personal/Item/field';
  t.after(() => { delete process.env.DEEPL_AUTH_KEY_OP_REF; });
  const fakeOp = await createFakeOp(t, { output: 'resolved-key:fx' });
  const calls = stubFetch(t, () => jsonResponse(200, { translations: [{ text: 'ok' }] }));

  const { translate: freshTranslate } = await importFreshDeepl();
  const result = await freshTranslate('hello', 'JA');

  assert.equal(result, 'ok');
  assert.equal(calls[0].init.headers['Authorization'], 'DeepL-Auth-Key resolved-key:fx');
  assert.equal(calls[0].url, 'https://api-free.deepl.com/v2/translate');
  assert.equal(await fakeOp.callCount(), 1);
});

test('translate caches the op-resolved key and does not invoke `op` again on a later call', async t => {
  delete process.env.DEEPL_AUTH_KEY;
  process.env.DEEPL_AUTH_KEY_OP_REF = 'op://Personal/Item/field';
  t.after(() => { delete process.env.DEEPL_AUTH_KEY_OP_REF; });
  const fakeOp = await createFakeOp(t, { output: 'cached-key' });
  stubFetch(t, () => jsonResponse(200, { translations: [{ text: 'ok' }] }));

  const { translate: freshTranslate } = await importFreshDeepl();
  await freshTranslate('hello', 'JA');
  await freshTranslate('world', 'JA');

  assert.equal(await fakeOp.callCount(), 1);
});

test('translate reports op-resolve-failed when `op read` fails, and never calls fetch', async t => {
  delete process.env.DEEPL_AUTH_KEY;
  process.env.DEEPL_AUTH_KEY_OP_REF = 'op://Personal/Item/field';
  t.after(() => { delete process.env.DEEPL_AUTH_KEY_OP_REF; });
  await createFakeOp(t, { exitCode: 1 });
  const calls = stubFetch(t, () => { throw new Error('must not be called'); });

  const { translate: freshTranslate, DeeplTranslationError: FreshDeeplTranslationError } = await importFreshDeepl();
  await assert.rejects(freshTranslate('hello', 'JA'), error => {
    assert.ok(error instanceof FreshDeeplTranslationError);
    assert.equal(error.kind, 'op-resolve-failed');
    return true;
  });
  assert.equal(calls.length, 0);
});

test('translate prefers DEEPL_AUTH_KEY over DEEPL_AUTH_KEY_OP_REF and never invokes `op`', async t => {
  process.env.DEEPL_AUTH_KEY = 'direct-key:fx';
  process.env.DEEPL_AUTH_KEY_OP_REF = 'op://Personal/Item/field';
  t.after(() => { delete process.env.DEEPL_AUTH_KEY; delete process.env.DEEPL_AUTH_KEY_OP_REF; });
  const fakeOp = await createFakeOp(t, { output: 'should-not-be-used' });
  const calls = stubFetch(t, () => jsonResponse(200, { translations: [{ text: 'ok' }] }));

  const { translate: freshTranslate } = await importFreshDeepl();
  await freshTranslate('hello', 'JA');

  assert.equal(calls[0].init.headers['Authorization'], 'DeepL-Auth-Key direct-key:fx');
  assert.equal(await fakeOp.callCount(), 0);
});

test('translate reports missing-key when neither DEEPL_AUTH_KEY nor DEEPL_AUTH_KEY_OP_REF is set', async t => {
  delete process.env.DEEPL_AUTH_KEY;
  delete process.env.DEEPL_AUTH_KEY_OP_REF;

  await assert.rejects(translate('hello', 'JA'), error => {
    assert.ok(error instanceof DeeplTranslationError);
    assert.equal(error.kind, 'missing-key');
    return true;
  });
});
