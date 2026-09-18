import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node.js';
import { toFullwidthAlphanumeric, toHalfwidthAlphanumeric } from '../src/engines/width.js';

test('width conversion preserves non-target characters and round trips ASCII alphanumerics', () => {
  const untouched = ' 日本語 😀 e\u0301 ｶﾞ ガ ① ㍑ !？\r\n';
  assert.equal(toFullwidthAlphanumeric('Az09' + untouched), 'Ａｚ０９ 日本語 😀 ｅ\u0301 ｶﾞ ガ ① ㍑ !？\r\n');
  assert.equal(toHalfwidthAlphanumeric(toFullwidthAlphanumeric('Az09' + untouched)), 'Az09' + untouched);
});

test('stdio LSP: unsaved incremental edits, UTF-16 positions and stale action rejection', { timeout: 10000 }, async t => {
  const child = spawn(process.execPath, ['src/lsp/server.js', '--stdio']);
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  const rpc = createMessageConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
  rpc.listen();
  t.after(() => { rpc.dispose(); child.kill(); assert.equal(errors, ''); });
  const initialized = await rpc.sendRequest('initialize', {
    processId: process.pid, rootUri: null,
    capabilities: {
      general: { positionEncodings: ['utf-8', 'utf-16'] },
      workspace: { workspaceEdit: { documentChanges: true } },
      textDocument: { codeAction: { resolveSupport: { properties: ['edit'] } } },
    },
  });
  assert.equal(initialized.capabilities.positionEncoding, 'utf-16');
  await rpc.sendNotification('initialized', {});
  const uri = 'file:///tmp/text-tools-test.txt';
  const text = '日本😀e\u0301 ABC09 終\r\n次の行';
  await rpc.sendNotification('textDocument/didOpen', { textDocument: { uri, languageId: 'plaintext', version: 1, text } });
  const range = { start: { line: 0, character: 7 }, end: { line: 0, character: 12 } };
  const params = { textDocument: { uri }, range, context: { diagnostics: [] } };
  const actions = await rpc.sendRequest('textDocument/codeAction', params);
  assert.equal(actions.length, 2);
  assert.equal(actions[0].edit, undefined);
  const resolved = await rpc.sendRequest('codeAction/resolve', actions[0]);
  const change = resolved.edit.documentChanges[0];
  assert.equal(change.textDocument.version, 1);
  assert.deepEqual(change.edits, [{ range, newText: 'ＡＢＣ０９' }]);
  assert.equal(text.slice(0, 7) + change.edits[0].newText + text.slice(12), '日本😀e\u0301 ＡＢＣ０９ 終\r\n次の行');
  await rpc.sendNotification('textDocument/didChange', {
    textDocument: { uri, version: 2 }, contentChanges: [{ range, text: 'XYZ12' }],
  });
  await assert.rejects(rpc.sendRequest('codeAction/resolve', actions[0]), error => error.code === -32801);
  const updated = await rpc.sendRequest('textDocument/codeAction', params);
  const result = await rpc.sendRequest('codeAction/resolve', updated[0]);
  assert.equal(result.edit.documentChanges[0].edits[0].newText, 'ＸＹＺ１２');
  assert.equal(result.edit.documentChanges[0].textDocument.version, 2);
  assert.deepEqual(await rpc.sendRequest('textDocument/codeAction', { ...params, range: { start: range.start, end: range.start } }), []);
  assert.deepEqual(await rpc.sendRequest('textDocument/codeAction', { ...params, range: { start: { line: 0, character: 3 }, end: range.end } }), []);
  assert.deepEqual(await rpc.sendRequest('textDocument/codeAction', { ...params, context: { diagnostics: [], only: ['quickfix'] } }), []);
  await rpc.sendNotification('textDocument/didClose', { textDocument: { uri } });
  assert.deepEqual(await rpc.sendRequest('textDocument/codeAction', params), []);
  await rpc.sendRequest('shutdown');
  await rpc.sendNotification('exit');
});
