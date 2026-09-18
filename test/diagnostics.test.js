import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDiagnostics } from '../src/lsp/diagnostics.js';

test('diagnostics discard in-flight results on edit and close, and recover after failure', async () => {
  const uri = 'file:///diagnostics.txt';
  let document = TextDocument.create(uri, 'plaintext', 1, '要確認');
  const pending = [];
  const published = [];
  const errors = [];
  const scheduler = createDiagnostics({
    documents: { get: () => document }, delay: 0,
    inspect: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    publish: result => published.push(result), onError: error => errors.push(error),
  });
  try {
    scheduler.schedule(document);
    await wait(10);
    document = TextDocument.create(uri, 'plaintext', 2, '修正済');
    scheduler.schedule(document);
    await wait(10);
    pending[0].resolve([{ start: 0, end: 3, message: 'stale' }]);
    pending[1].resolve([]);
    await wait(10);
    assert.deepEqual(published.map(item => item.version), [2]);
    scheduler.schedule(document);
    await wait(10);
    scheduler.close(uri);
    pending[2].resolve([{ start: 0, end: 3, message: 'closed' }]);
    await wait(10);
    assert.deepEqual(published.at(-1), { uri, diagnostics: [] });
    assert.equal(published.length, 2);
    scheduler.schedule(document);
    await wait(10);
    pending[3].reject(new Error('engine failure'));
    await wait(10);
    assert.equal(errors.length, 1);
    assert.deepEqual(published.at(-1).diagnostics, []);
    scheduler.schedule(document);
    scheduler.schedule(document);
    await wait(10);
    assert.equal(pending.length, 5);
    pending[4].resolve([]);
    await wait(10);
    assert.equal(published.length, 4);
  } finally { scheduler.dispose(); }
});
