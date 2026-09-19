// E2E テスト専用のダミー翻訳プロバイダー。実際の DeepL 通信をせずに、
// create-server.js の command 実行の仕組み（候補列挙では実行されないこと、
// executeCommand でのみ実行されること）を検証するために使う。製品コード（src/）には置かない。

// 候補列挙（textDocument/codeAction）の時点で誤って呼ばれていないかを証明するための実装。
// 呼ばれたら即座に例外を投げるので、onCodeAction 内で誤って実行されれば
// テストのサーバープロセスがエラーを標準エラーに出す（呼び出し側で検知できる）。
export function throwingTranslate() {
  throw new Error('throwingTranslate must not be called during code action listing.');
}

// executeCommand 経由でのみ呼ばれることを想定した、決定的な変換を返す実装。
export async function workingTranslate(text) {
  return `[翻訳]${text}`;
}

// 二重実行の抑止を検証するため、意図的に遅延させて完了させる実装。
// create-server.js 側のガード（inFlightTranslationsByUri）は provider.translate を呼ぶ前に
// 判定するため、この遅延そのものを厳密に制御する必要はなく、同時に 2 回送った
// executeCommand のうち後発が拒否されることを確認できれば十分。
export function delayedTranslate(delayMs) {
  return async text => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return `[翻訳]${text}`;
  };
}
