import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node.js';
import { proofread } from '../src/engines/proofread.js';

test('proofread reports regex-based rules at their UTF-16 offset, unaffected by a preceding emoji', async () => {
  const text = '\u{1F600}あ​い。'; // 😀あ<zero-width-space>い。
  const findings = await proofread(text);
  assert.equal(findings.length, 1);
  assert.equal(text.slice(findings[0].start, findings[0].end), '​');
  assert.match(findings[0].message, /no-zero-width-spaces/);
});

test('proofread detects morphological-analysis rules when there is no emoji', async () => {
  const text = '食べれる。'; // 食べれる。
  const findings = await proofread(text);
  assert.equal(findings.length, 1);
  assert.equal(text.slice(findings[0].start, findings[0].end), 'れ'); // れ
  assert.match(findings[0].message, /no-dropping-the-ra/);
});

const morphologicalCases = [
  ['no-dropping-the-ra', '食べれる。', 2, 'れ'],
  ['max-ten', 'これは、とても、長くて、読点が、多い、文章、です。', 15, '、'],
  ['no-doubled-conjunctive-particle-ga', '雨が降っていますが、風も強いですが、出かけます。', 8, 'が'],
  ['no-doubled-conjunction', 'しかし、行きます。しかし、帰ります。', 9, 'しかし'],
  ['no-doubled-joshi', '私は彼は好きです。', 3, 'は'],
  ['no-double-negative-ja', '食べないわけではない。', 8, 'な'],
  ['no-mix-dearu-desumasu', 'これは本である。これは本です。', 4, 'で'],
];

for (const [rule, sample, offset, selected] of morphologicalCases) {
  test(`proofread preserves ${rule} with astral characters and node boundaries`, async () => {
    for (const prefix of ['', '😀', '😀😀', '𠮷', '👩‍💻', '前置き😀。\r\n\r\né。\n']) {
      const text = prefix + sample;
      // Repeat to exercise kuromojin's cached-token path without double conversion.
      for (let attempt = 0; attempt < 2; attempt++) {
        const findings = (await proofread(text)).filter(f => f.message.endsWith(`（preset-japanese/${rule}）`));
        assert.equal(findings.length, 1, `${rule}: ${text}`);
        assert.equal(findings[0].start, prefix.length + offset, text);
        assert.equal(findings[0].end, prefix.length + offset + selected.length, text);
        assert.equal(text.slice(findings[0].start, findings[0].end), selected);
      }
    }
  });
}

test('regex diagnostics keep UTF-16 ranges alongside morphological diagnostics', async () => {
  const text = '😀😀食べれる。\r\n😀か\u3099。\n😀あ\u200bい。';
  const findings = await proofread(text);
  for (const [rule, target] of [['no-dropping-the-ra', 'れ'], ['no-nfd', '\u3099'], ['no-zero-width-spaces', '\u200b']]) {
    const finding = findings.find(f => f.message.endsWith(`（preset-japanese/${rule}）`));
    assert.ok(finding, rule);
    assert.equal(finding.start, text.indexOf(target), rule);
    assert.equal(text.slice(finding.start, finding.end), target, rule);
  }
});

test('proofread skips heavy sentence-splitting rules above the size cap', async () => {
  const violatesMaxTen = 'これは、とても、長くて、読点が、多い、文章、です。';
  const short = await proofread(violatesMaxTen);
  assert.ok(short.some(f => f.message.includes('max-ten')));

  const long = (violatesMaxTen + '\n').repeat(Math.ceil(31000 / (violatesMaxTen.length + 1))).slice(0, 31000);
  const findings = await proofread(long);
  assert.ok(!findings.some(f => f.message.includes('max-ten')));
});

test('proofread ignores a .textlintrc in the current working directory', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'zed-text-tools-textlintrc-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(path.join(dir, '.textlintrc.json'), JSON.stringify({ rules: {}, filters: { comments: true } }));
  const originalCwd = process.cwd();
  process.chdir(dir);
  try {
    const findings = await proofread('食べれる。'); // 食べれる。
    assert.ok(findings.some(f => f.message.includes('no-dropping-the-ra')));
  } finally {
    process.chdir(originalCwd);
  }
});

test('stdio LSP: proofreading extension enables diagnostics by default and offers no conversions', { timeout: 10000 }, async t => {
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
  // diagnostics.enabled を明示しない。校正拡張は既定で有効であるべき。
  await rpc.sendRequest('initialize', {
    processId: process.pid, rootUri: null,
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
    textDocument: { uri, version: 2 }, contentChanges: [{ text: '😀😀。\r\n前置き𠮷食べれる。' }], // 前置き食べれる。
  });
  const diagnosis = await nextDiagnostics(2);
  assert.equal(diagnosis.diagnostics.length, 1);
  assert.equal(diagnosis.diagnostics[0].severity, 3);
  assert.match(diagnosis.diagnostics[0].message, /no-dropping-the-ra/);
  assert.deepEqual(diagnosis.diagnostics[0].range, { start: { line: 1, character: 7 }, end: { line: 1, character: 8 } });
  await rpc.sendNotification('textDocument/didClose', { textDocument: { uri } });
  await rpc.sendRequest('shutdown');
  await rpc.sendNotification('exit');
});

test('stdio LSP: proofreading extension diagnostics can be explicitly disabled', { timeout: 10000 }, async t => {
  const child = spawn(process.execPath, ['src/lsp/proofreading-server.js', '--stdio']);
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  const rpc = createMessageConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
  const publications = [];
  rpc.onNotification('textDocument/publishDiagnostics', params => publications.push(params));
  rpc.listen();
  t.after(() => { rpc.dispose(); child.kill(); assert.equal(errors, ''); });
  await rpc.sendRequest('initialize', {
    processId: process.pid, rootUri: null,
    initializationOptions: { diagnostics: { enabled: false } },
    capabilities: {},
  });
  await rpc.sendNotification('initialized', {});
  const uri = 'file:///tmp/text-tools-proofreading-disabled-test.txt';
  await rpc.sendNotification('textDocument/didOpen', {
    textDocument: { uri, languageId: 'plaintext', version: 1, text: '食べれる。' }, // 食べれる。
  });
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.deepEqual(publications, []);
  await rpc.sendNotification('textDocument/didClose', { textDocument: { uri } });
  await rpc.sendRequest('shutdown');
  await rpc.sendNotification('exit');
});
