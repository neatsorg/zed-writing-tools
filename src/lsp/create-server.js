import { createConnection, TextDocuments, TextDocumentSyncKind, ResponseError, LSPErrorCodes } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { makeEdit, selectedText } from './actions.js';
import { createDiagnostics } from './diagnostics.js';

const TRANSLATE_COMMAND = 'text-tools.translate';

// 翻訳プロバイダーのエラーを利用者向けの日本語メッセージへ変換する。エンジン実装
// （src/engines/deepl.js の DeeplTranslationError）に依存させず、error.kind の有無だけで
// 判定する（テスト用ダミーエンジンなど、素の Error を投げる実装でも動く）。
// 原文・訳文・APIキーはどの分岐でもメッセージに含めない。
function translationErrorMessage(error) {
  switch (error?.kind) {
    case 'missing-key': return 'DEEPL_AUTH_KEY が設定されていません。環境変数を設定してから言語サーバーを再起動してください。';
    case 'op-resolve-failed': return '1Password からのAPIキー取得に失敗しました。op コマンドの状態を確認してください。';
    case 'auth': return 'DeepL の認証に失敗しました。APIキーを確認してください。';
    case 'quota': return 'DeepL の利用上限に達しました。';
    case 'rate-limit': return 'DeepL が混雑しています。しばらく待ってから再試行してください。';
    case 'too-large': return '選択範囲が大きすぎるため翻訳できません。範囲を小さくしてください。';
    case 'timeout': return 'DeepL への通信がタイムアウトしました。';
    case 'cancelled': return undefined; // ユーザー操作によるキャンセルなので案内不要。
    case 'network': return 'DeepL への通信に失敗しました。ネットワーク接続を確認してください。';
    default: return '翻訳に失敗しました。';
  }
}

// transformations・inspections・translations を注入して LSP サーバーを構築する。
// 変換拡張・校正拡張・翻訳拡張の各エントリーポイント（src/lsp/server.js・
// src/lsp/proofreading-server.js・src/lsp/translation-server.js）は、それぞれ src/features/ の
// 対応するモジュールから必要な機能だけを渡す薄いラッパー。
// テストは、本格エンジン接続前でも診断・変換・翻訳の両立を検証できるよう、
// ここへダミーの inspections/translations を渡した別のエントリーポイントから使う。
//
// translations は transformations とは別経路（LSP の command / workspace.executeCommand）で実行する。
// transformations は codeAction 列挙時にクライアントが resolve を宣言しなければその場で resolveAction
// （= provider.transform 実行）まで進む（下記 lazyEdits 分岐）。ローカルな純粋変換では無害だが、
// 翻訳のような副作用（外部送信・課金）を伴う処理をこの経路に乗せると、候補を列挙しただけで実行されて
// しまう。command は LSP 仕様上ユーザーが実際にアクションを選択したときにのみクライアントから呼ばれ、
// onCodeAction・resolve の経路を一切通らないため、翻訳は必ずこちらを使う。
export function createServer({ transformations, inspections, translations = [] }) {
  const connection = createConnection();
  const documents = new TextDocuments(TextDocument);
  let enabled = true;
  let translationEnabled = true;
  let versionedEdits = false;
  let lazyEdits = false;
  let diagnostics;
  const inFlightTranslationsByUri = new Set();

  connection.onInitialize(params => {
    enabled = params.initializationOptions?.conversion !== false;
    // inspections がある拡張（校正拡張）では既定で診断を有効にし、明示的な false でのみ無効化する。
    // inspections が空（変換拡張、または本格校正エンジン接続前）では、設定に関わらず診断を開始しない。
    if (params.initializationOptions?.diagnostics?.enabled !== false && inspections.length > 0) {
      diagnostics = createDiagnostics({
        documents,
        publish: params => connection.sendDiagnostics(params),
        inspect: (text, signal) => inspections[0].inspect(text, signal),
        onError: message => connection.console.error(message),
      });
    }
    // translations がある拡張（翻訳拡張）では既定で有効にし、明示的な false でのみ無効化する
    // （diagnostics.enabled と同じパターン）。
    translationEnabled = params.initializationOptions?.translation?.enabled !== false;
    versionedEdits = params.capabilities.workspace?.workspaceEdit?.documentChanges === true;
    lazyEdits = params.capabilities.textDocument?.codeAction?.resolveSupport?.properties?.includes('edit') === true;
    return { capabilities: {
      positionEncoding: 'utf-16',
      textDocumentSync: TextDocumentSyncKind.Incremental,
      codeActionProvider: { codeActionKinds: ['refactor.rewrite'], resolveProvider: true },
      ...(translations.length > 0 && translationEnabled ? { executeCommandProvider: { commands: [TRANSLATE_COMMAND] } } : {}),
    } };
  });

  connection.onCodeAction(async (params, token) => {
    if (params.context.only && !params.context.only.some(kind => 'refactor.rewrite' === kind || 'refactor.rewrite'.startsWith(kind + '.'))) return [];
    const document = documents.get(params.textDocument.uri);
    if (!document || selectedText(document, params.range) === null) return [];

    const transformActions = (!enabled || !versionedEdits) ? [] : transformations.map(provider => ({
      title: provider.title, kind: 'refactor.rewrite',
      data: { id: provider.id, uri: document.uri, version: document.version, range: params.range },
    }));
    // These initial providers are local and pure. External providers must require resolve.
    const resolvedTransformActions = lazyEdits ? transformActions : await Promise.all(transformActions.map(action => resolveAction(action, token)));

    // 翻訳アクションは data/edit を持たせない。command のみを持たせることで、上の
    // resolveProvider 経路（列挙時の eager resolve を含む）に一切乗らないようにする。
    const translateActions = (!translationEnabled || !versionedEdits) ? [] : translations.map(provider => ({
      title: provider.title, kind: 'refactor.rewrite',
      command: {
        title: provider.title, command: TRANSLATE_COMMAND,
        arguments: [{ id: provider.id, uri: document.uri, version: document.version, range: params.range }],
      },
    }));

    return [...resolvedTransformActions, ...translateActions];
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

  // showErrorMessage は window/showMessageRequest への応答を待つ Promise を返す。
  // ここでは fire-and-forget で使うため、クライアントが応答しないまま接続が閉じる等で
  // reject してもプロセスを落とさないよう明示的に握りつぶす。
  function notifyError(message) {
    if (message) connection.window.showErrorMessage(message).catch(() => {});
  }

  // 翻訳（DeepL）はここでのみ実行する。ユーザーが Code Action を実際に選択したときに
  // クライアントから呼ばれる（列挙・resolve の経路からは呼ばれない）。
  connection.onExecuteCommand(async (params, token) => {
    if (params.command !== TRANSLATE_COMMAND) return;
    // onCodeAction は無効時に候補自体を隠すが、command はクライアントが直接呼べる独立した
    // 経路なので、実行側でも無効化設定と必要なクライアント機能を確認する（無効化を隠すだけの
    // 対策にしない。外部送信の前に必ず拒否する）。
    if (!translationEnabled || !versionedEdits) return;
    const [arg] = params.arguments ?? [];
    const document = arg && documents.get(arg.uri);
    const provider = translations.find(item => item.id === arg?.id);
    if (!document || document.version !== arg.version || !provider || !arg.range) {
      notifyError('文書が変更されました。翻訳をもう一度選び直してください。');
      return;
    }
    const text = selectedText(document, arg.range);
    if (text === null) {
      notifyError('選択範囲が無効です。');
      return;
    }
    if (provider.maxTextBytes && Buffer.byteLength(text, 'utf8') > provider.maxTextBytes) {
      notifyError('選択範囲が大きすぎるため翻訳できません。範囲を小さくしてください。');
      return;
    }
    if (inFlightTranslationsByUri.has(document.uri)) {
      notifyError('この文書はすでに翻訳を実行中です。完了までお待ちください。');
      return;
    }

    inFlightTranslationsByUri.add(document.uri);
    const controller = new AbortController();
    const subscription = token.onCancellationRequested(() => controller.abort());
    try {
      const translated = await provider.translate(text, controller.signal);
      if (token.isCancellationRequested) return;
      if (documents.get(arg.uri) !== document || document.version !== arg.version) {
        notifyError('翻訳中に文書が変更されたため、結果を破棄しました。');
        return;
      }
      const result = await connection.workspace.applyEdit(makeEdit(document, arg.range, translated));
      // applyEdit は例外を投げず { applied: false } を返すことがある（クライアント側の都合等）。
      // 翻訳自体は完了・課金済みの可能性があるため、黙って捨てず必ず案内する。自動再試行はしない。
      if (!result.applied) {
        notifyError('翻訳結果を反映できませんでした。文書を確認し、必要なら翻訳をやり直してください。');
      }
    } catch (error) {
      notifyError(translationErrorMessage(error));
    } finally {
      subscription.dispose();
      inFlightTranslationsByUri.delete(document.uri);
    }
  });

  documents.onDidChangeContent(({ document }) => diagnostics?.schedule(document));
  documents.onDidClose(({ document }) => diagnostics?.close(document.uri));
  connection.onShutdown(() => diagnostics?.dispose());
  documents.listen(connection);
  return connection;
}
