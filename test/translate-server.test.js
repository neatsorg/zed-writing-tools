import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node.js';

// create-server.js の翻訳（DeepL 想定）まわりを、ダミー翻訳プロバイダー（test/fixtures/）を
// 注入した専用サーバー（test/fixtures/test-translation-server.js）を通して検証する。
// 実際の DeepL 通信は行わない（src/engines/deepl.js 単体のテストは test/deepl.test.js）。
//
// 最重要の確認事項: 候補表示（textDocument/codeAction）だけでは翻訳が一切実行されないこと。
// 副作用（外部送信・課金）を伴う操作なので、実行はユーザーが明示的に選択したときの
// workspace/executeCommand 経由でのみ起きる必要がある。

function startClient(t, { initializationOptions, applyEditResult = { applied: true } } = {}) {
  const child = spawn(process.execPath, ['test/fixtures/test-translation-server.js', '--stdio']);
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  const rpc = createMessageConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
  const showMessageRequests = [];
  const applyEditRequests = [];
  rpc.onRequest('window/showMessageRequest', params => { showMessageRequests.push(params); return null; });
  rpc.onRequest('workspace/applyEdit', params => { applyEditRequests.push(params); return applyEditResult; });
  rpc.listen();
  t.after(() => { rpc.dispose(); child.kill(); assert.equal(errors, ''); });
  return { rpc, showMessageRequests, applyEditRequests, initializationOptions };
}

async function initialize(rpc, initializationOptions) {
  const result = await rpc.sendRequest('initialize', {
    processId: process.pid, rootUri: null,
    initializationOptions,
    capabilities: {
      general: { positionEncodings: ['utf-8', 'utf-16'] },
      workspace: { workspaceEdit: { documentChanges: true } },
      textDocument: { codeAction: { resolveSupport: { properties: ['edit'] } } },
    },
  });
  await rpc.sendNotification('initialized', {});
  return result;
}

const URI = 'file:///tmp/text-tools-translate-test.txt';
const TEXT = 'Hello world';
const RANGE = { start: { line: 0, character: 0 }, end: { line: 0, character: 11 } };

async function openDocument(rpc, version = 1, text = TEXT) {
  await rpc.sendNotification('textDocument/didOpen', { textDocument: { uri: URI, languageId: 'plaintext', version, text } });
}

test('stdio LSP translate: listing code actions never invokes translate', { timeout: 10000 }, async t => {
  const { rpc } = startClient(t);
  await initialize(rpc);
  await openDocument(rpc);
  const actions = await rpc.sendRequest('textDocument/codeAction', {
    textDocument: { uri: URI }, range: RANGE, context: { diagnostics: [] },
  });
  const translateAction = actions.find(a => a.command?.arguments?.[0]?.id === 'test.translate.throwing');
  assert.ok(translateAction, 'expected a translate action for the throwing dummy provider');
  assert.equal(translateAction.edit, undefined);
  assert.equal(translateAction.command.command, 'text-tools.translate');
  await rpc.sendRequest('shutdown');
  await rpc.sendNotification('exit');
});

test('stdio LSP translate: executeCommand runs translate and applies the edit', { timeout: 10000 }, async t => {
  const { rpc, applyEditRequests } = startClient(t);
  await initialize(rpc);
  await openDocument(rpc);
  const result = await rpc.sendRequest('workspace/executeCommand', {
    command: 'text-tools.translate',
    arguments: [{ id: 'test.translate.working', uri: URI, version: 1, range: RANGE }],
  });
  assert.equal(result, null);
  assert.equal(applyEditRequests.length, 1);
  const change = applyEditRequests[0].edit.documentChanges[0];
  assert.equal(change.textDocument.version, 1);
  assert.deepEqual(change.edits, [{ range: RANGE, newText: '[翻訳]Hello world' }]);
  await rpc.sendRequest('shutdown');
  await rpc.sendNotification('exit');
});

test('stdio LSP translate: a stale version is rejected without calling translate or applying an edit', { timeout: 10000 }, async t => {
  const { rpc, applyEditRequests, showMessageRequests } = startClient(t);
  await initialize(rpc);
  await openDocument(rpc);
  await rpc.sendNotification('textDocument/didChange', {
    textDocument: { uri: URI, version: 2 }, contentChanges: [{ text: 'Changed text' }],
  });
  await rpc.sendRequest('workspace/executeCommand', {
    // "throwing" プロバイダーを使うことで、バージョン不一致のガードを通り抜けて
    // translate が呼ばれてしまった場合はサーバーが例外を出す（t.after で検知）。
    command: 'text-tools.translate',
    arguments: [{ id: 'test.translate.throwing', uri: URI, version: 1, range: RANGE }],
  });
  assert.equal(applyEditRequests.length, 0);
  assert.equal(showMessageRequests.length, 1);
  await rpc.sendRequest('shutdown');
  await rpc.sendNotification('exit');
});

test('stdio LSP translate: a document change during translation discards the result', { timeout: 10000 }, async t => {
  const { rpc, applyEditRequests, showMessageRequests } = startClient(t);
  await initialize(rpc);
  await openDocument(rpc);
  const executed = rpc.sendRequest('workspace/executeCommand', {
    command: 'text-tools.translate',
    arguments: [{ id: 'test.translate.slow', uri: URI, version: 1, range: RANGE }],
  });
  await new Promise(resolve => setTimeout(resolve, 20));
  await rpc.sendNotification('textDocument/didChange', {
    textDocument: { uri: URI, version: 2 }, contentChanges: [{ text: 'Changed text' }],
  });
  await executed;
  assert.equal(applyEditRequests.length, 0);
  assert.equal(showMessageRequests.length, 1);
  await rpc.sendRequest('shutdown');
  await rpc.sendNotification('exit');
});

test('stdio LSP translate: a selection larger than the provider limit is rejected before calling translate', { timeout: 10000 }, async t => {
  const { rpc, applyEditRequests, showMessageRequests } = startClient(t);
  await initialize(rpc);
  await openDocument(rpc);
  await rpc.sendRequest('workspace/executeCommand', {
    // "sized" プロバイダーは maxTextBytes: 4、実装は throwingTranslate。
    // ガードが効いていなければ translate が呼ばれてサーバーが例外を出す。
    command: 'text-tools.translate',
    arguments: [{ id: 'test.translate.sized', uri: URI, version: 1, range: RANGE }],
  });
  assert.equal(applyEditRequests.length, 0);
  assert.equal(showMessageRequests.length, 1);
  await rpc.sendRequest('shutdown');
  await rpc.sendNotification('exit');
});

test('stdio LSP translate: a second concurrent execution on the same document is rejected', { timeout: 10000 }, async t => {
  const { rpc, applyEditRequests, showMessageRequests } = startClient(t);
  await initialize(rpc);
  await openDocument(rpc);
  const args = { command: 'text-tools.translate', arguments: [{ id: 'test.translate.slow', uri: URI, version: 1, range: RANGE }] };
  const [first, second] = await Promise.all([rpc.sendRequest('workspace/executeCommand', args), rpc.sendRequest('workspace/executeCommand', args)]);
  assert.equal(applyEditRequests.length, 1);
  assert.equal(showMessageRequests.length, 1);
  await rpc.sendRequest('shutdown');
  await rpc.sendNotification('exit');
});

test('stdio LSP translate: initializationOptions.translation.enabled: false disables the feature entirely', { timeout: 10000 }, async t => {
  const { rpc, applyEditRequests } = startClient(t);
  const initResult = await initialize(rpc, { translation: { enabled: false } });
  assert.equal(initResult.capabilities.executeCommandProvider, undefined);
  await openDocument(rpc);
  const actions = await rpc.sendRequest('textDocument/codeAction', {
    textDocument: { uri: URI }, range: RANGE, context: { diagnostics: [] },
  });
  assert.equal(actions.some(a => a.command?.command === 'text-tools.translate'), false);

  // 無効化は候補の非表示だけに頼らない: クライアントが列挙をバイパスして直接
  // workspace/executeCommand を送っても、実行ハンドラー側で拒否されること（防御的な多層チェック）。
  // "working" プロバイダーを使う（"throwing" だと、ガードが無くても例外で applyEdit に
  // 到達しないため、このテストがガードの有無を区別できない）。ガードが無ければ本当に
  // 翻訳が成功し applyEdit が呼ばれてしまうので、その場合だけこのアサーションが落ちる。
  await rpc.sendRequest('workspace/executeCommand', {
    command: 'text-tools.translate',
    arguments: [{ id: 'test.translate.working', uri: URI, version: 1, range: RANGE }],
  });
  assert.equal(applyEditRequests.length, 0);

  await rpc.sendRequest('shutdown');
  await rpc.sendNotification('exit');
});

test('stdio LSP translate: a client-reported applyEdit failure is surfaced, not silently ignored', { timeout: 10000 }, async t => {
  const { rpc, applyEditRequests, showMessageRequests } = startClient(t, { applyEditResult: { applied: false } });
  await initialize(rpc);
  await openDocument(rpc);
  await rpc.sendRequest('workspace/executeCommand', {
    command: 'text-tools.translate',
    arguments: [{ id: 'test.translate.working', uri: URI, version: 1, range: RANGE }],
  });
  assert.equal(applyEditRequests.length, 1); // 翻訳は実行され、適用が試みられた。
  assert.equal(showMessageRequests.length, 1); // だが反映失敗が案内された。
  await rpc.sendRequest('shutdown');
  await rpc.sendNotification('exit');
});
