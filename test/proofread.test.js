import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node.js';
import { proofread } from '../src/engines/proofread.js';

test('proofread converts textlint code point positions to UTF-16 offsets across an emoji', async () => {
  const text = '前置き😀食べれる。'; // 前置き😀食べれる。
  const findings = await proofread(text);
  assert.equal(findings.length, 1);
  assert.equal(text.slice(findings[0].start, findings[0].end), 'れ'); // れ
  assert.match(findings[0].message, /no-dropping-the-ra/);
});

test('proofread skips heavy sentence-splitting rules above the size cap', async () => {
  const violatesMaxTen = 'これは、とても、長くて、読点が、多い、文章、です。';
  const short = await proofread(violatesMaxTen);
  assert.ok(short.some(f => f.message.includes('max-ten')));

  const long = (violatesMaxTen + '\n').repeat(Math.ceil(31000 / (violatesMaxTen.length + 1))).slice(0, 31000);
  const findings = await proofread(long);
  assert.ok(!findings.some(f => f.message.includes('max-ten')));
});

test('stdio LSP: proofreading extension reports diagnostics and offers no conversions', { timeout: 10000 }, async t => {
  const child = spawn(process.execPath, ['src/lsp/proofreading-server.js', '--stdio']);
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  const rpc = createMessageConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
  const publications = [];
  rpc.onNotification('textDocument/publishDiagnostics', params => publications.push(params));
  async function nextDiagnostics(version) {
    for (let i = 0; i < 300; i++) {
      const result = publications.find(item => item.version === version);
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail('diagnostics not received');
  }
  rpc.listen();
  t.after(() => { rpc.dispose(); child.kill(); assert.equal(errors, ''); });
  await rpc.sendRequest('initialize', {
    processId: process.pid, rootUri: null,
    initializationOptions: { diagnostics: { enabled: true } },
    capabilities: {
      general: { positionEncodings: ['utf-8', 'utf-16'] },
      workspace: { workspaceEdit: { documentChanges: true } },
      textDocument: { codeAction: { resolveSupport: { properties: ['edit'] } } },
    },
  });
  await rpc.sendNotification('initialized', {});
  const uri = 'file:///tmp/text-tools-proofreading-test.txt';
  await rpc.sendNotification('textDocument/didOpen', {
    textDocument: { uri, languageId: 'plaintext', version: 1, text: '前置き食べる。' }, // 前置き食べる。
  });
  const range = { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } };
  const actions = await rpc.sendRequest('textDocument/codeAction', {
    textDocument: { uri }, range, context: { diagnostics: [] },
  });
  assert.deepEqual(actions, []); // 校正拡張は変換の Code Action を提供しない
  await rpc.sendNotification('textDocument/didChange', {
    textDocument: { uri, version: 2 }, contentChanges: [{ text: '前置き食べれる。' }], // 前置き食べれる。
  });
  const diagnosis = await nextDiagnostics(2);
  assert.equal(diagnosis.diagnostics.length, 1);
  assert.equal(diagnosis.diagnostics[0].severity, 3);
  assert.match(diagnosis.diagnostics[0].message, /no-dropping-the-ra/);
  await rpc.sendNotification('textDocument/didClose', { textDocument: { uri } });
  await rpc.sendRequest('shutdown');
  await rpc.sendNotification('exit');
});
