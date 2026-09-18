import { createConnection, TextDocuments, TextDocumentSyncKind, ResponseError, LSPErrorCodes } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { makeEdit, selectedText } from './actions.js';
import { createDiagnostics } from './diagnostics.js';

// transformations・inspections を注入して LSP サーバーを構築する。
// 本体（server.js）は features.js の内容を渡すだけの薄いエントリーポイント。
// テストは、本格校正エンジン接続前でも診断と変換の両立を検証できるよう、
// ここへダミーの inspections を渡した別のエントリーポイントから使う。
export function createServer({ transformations, inspections }) {
  const connection = createConnection();
  const documents = new TextDocuments(TextDocument);
  let enabled = true;
  let versionedEdits = false;
  let lazyEdits = false;
  let diagnostics;

  connection.onInitialize(params => {
    enabled = params.initializationOptions?.conversion !== false;
    // inspections が空の間（本格校正エンジン接続前）は、設定で有効化しても診断を開始しない。
    if (params.initializationOptions?.diagnostics?.enabled === true && inspections.length > 0) {
      diagnostics = createDiagnostics({
        documents,
        publish: params => connection.sendDiagnostics(params),
        inspect: (text, signal) => inspections[0].inspect(text, signal),
        onError: message => connection.console.error(message),
      });
    }
    versionedEdits = params.capabilities.workspace?.workspaceEdit?.documentChanges === true;
    lazyEdits = params.capabilities.textDocument?.codeAction?.resolveSupport?.properties?.includes('edit') === true;
    return { capabilities: {
      positionEncoding: 'utf-16',
      textDocumentSync: TextDocumentSyncKind.Incremental,
      codeActionProvider: { codeActionKinds: ['refactor.rewrite'], resolveProvider: true },
    } };
  });

  connection.onCodeAction(async (params, token) => {
    if (!enabled || !versionedEdits) return [];
    if (params.context.only && !params.context.only.some(kind => 'refactor.rewrite' === kind || 'refactor.rewrite'.startsWith(kind + '.'))) return [];
    const document = documents.get(params.textDocument.uri);
    if (!document || selectedText(document, params.range) === null) return [];
    const actions = transformations.map(provider => ({
      title: provider.title, kind: 'refactor.rewrite',
      data: { id: provider.id, uri: document.uri, version: document.version, range: params.range },
    }));
    // These initial providers are local and pure. External providers must require resolve.
    return lazyEdits ? actions : Promise.all(actions.map(action => resolveAction(action, token)));
  });

  async function resolveAction(action, token) {
    const data = action.data;
    const document = data && documents.get(data.uri);
    const provider = transformations.find(item => item.id === data?.id);
    if (!document || document.version !== data.version || !provider || !data.range) {
      throw new ResponseError(LSPErrorCodes.ContentModified, '文書が変更されました。変換を選び直してください。');
    }
    const text = selectedText(document, data.range);
    if (text === null) throw new ResponseError(LSPErrorCodes.ContentModified, '選択範囲が無効です。');
    const controller = new AbortController();
    const subscription = token.onCancellationRequested(() => controller.abort());
    try {
      if (token.isCancellationRequested) throw new ResponseError(LSPErrorCodes.RequestCancelled, 'キャンセルされました。');
      const newText = await provider.transform(text, controller.signal);
      if (token.isCancellationRequested) throw new ResponseError(LSPErrorCodes.RequestCancelled, 'キャンセルされました。');
      if (documents.get(data.uri) !== document || document.version !== data.version) {
        throw new ResponseError(LSPErrorCodes.ContentModified, '文書が変更されました。');
      }
      return { ...action, edit: makeEdit(document, data.range, newText) };
    } finally { subscription.dispose(); }
  }

  connection.onCodeActionResolve(resolveAction);
  documents.onDidChangeContent(({ document }) => diagnostics?.schedule(document));
  documents.onDidClose(({ document }) => diagnostics?.close(document.uri));
  connection.onShutdown(() => diagnostics?.dispose());
  documents.listen(connection);
  return connection;
}
