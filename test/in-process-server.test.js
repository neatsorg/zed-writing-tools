import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node.js';
import { createServer } from '../src/lsp/create-server.js';
import { transformations } from '../src/features/conversion.js';

const capabilities = {
  general: { positionEncodings: ['utf-8', 'utf-16'] },
  workspace: { workspaceEdit: { documentChanges: true } },
  textDocument: { codeAction: { resolveSupport: { properties: ['edit'] } } },
};

function startInProcessServer(t) {
  const clientToServer = new PassThrough();
  const serverToClient = new PassThrough();
  const server = createServer({
    transformations,
    inspections: [],
    input: clientToServer,
    output: serverToClient,
  });
  const rpc = createMessageConnection(
    new StreamMessageReader(serverToClient),
    new StreamMessageWriter(clientToServer),
  );
  server.listen();
  rpc.listen();
  t.after(() => {
    rpc.dispose();
    server.dispose();
    clientToServer.end();
    serverToClient.end();
  });
  return rpc;
}

test('in-process LSP: conversion actions use the real JSON-RPC server', async t => {
  const rpc = startInProcessServer(t);
  const initialized = await rpc.sendRequest('initialize', {
    processId: process.pid,
    rootUri: null,
    capabilities,
  });
  assert.equal(initialized.capabilities.positionEncoding, 'utf-16');
  await rpc.sendNotification('initialized', {});

  const uri = 'file:///tmp/writing-tools-in-process-test.txt';
  const text = '日本😀é ABC09 終';
  await rpc.sendNotification('textDocument/didOpen', {
    textDocument: { uri, languageId: 'plaintext', version: 1, text },
  });
  const range = { start: { line: 0, character: 7 }, end: { line: 0, character: 12 } };
  const actions = await rpc.sendRequest('textDocument/codeAction', {
    textDocument: { uri },
    range,
    context: { diagnostics: [] },
  });
  assert.equal(actions.length, 12);
  assert.equal(actions[0].edit, undefined);

  const resolved = await rpc.sendRequest('codeAction/resolve', actions[0]);
  assert.deepEqual(resolved.edit.documentChanges[0].edits, [
    { range, newText: 'ＡＢＣ０９' },
  ]);

  await rpc.sendRequest('shutdown');
  await rpc.sendNotification('exit');
});
