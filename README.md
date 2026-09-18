# Zed Text Tools

開発初期版。`.txt`（Zed の `Plain Text`）の選択範囲に対して、英数字を半角／全角へ変換します。
記号、空白、カナの変換はまだありません。無選択時は何もしません。

## 構造

- `src/engines/width.js`: 文字列 → 文字列の純粋関数。LSP・Zed に依存しません。
- `src/features.js`: 機能 ID・表示名・変換関数の登録。後続機能をここから接続します。
- `src/lsp/`: 文書同期、UTF-16 位置、Code Action、文書バージョンを扱うアダプター。
- `extension/`: サーバーを起動するだけの Zed 拡張。

共通サーバーに機能を追加する構成です。サーバーの標準入出力は標準 LSP であり、
他のエディタからも起動できます。変換エンジンは単独で取り出せます。
任意コマンドや動的プラグインの実行機構は導入していません。

責務の境界、開発順序、単一リポジトリでの管理方針は [設計方針](docs/architecture.md) を参照してください。

## 開発

Node.js 22 以降、Rust と `wasm32-wasip2` ターゲットを使用します。

```sh
npm ci --ignore-scripts
npm test
cargo build --manifest-path extension/Cargo.toml --target wasm32-wasip2 --release --locked
```

## Zed での動作確認

1. このプロジェクトを任意の場所に置き、`npm ci --ignore-scripts` を実行します。
2. `npm run setup:example` を実行します。現在の Node.js 実行パスとプロジェクトの
   配置先から、Git 対象外の `examples/.zed/settings.json` を生成します。
   既存ファイルは上書きしません。配置先を移動した場合は、既存設定を退避して再生成してください。
3. Zed の `zed: install dev extension` で、このプロジェクトの `extension` ディレクトリを選びます。
   ビルドには Rust と `wasm32-wasip2` ターゲットが必要です。
4. `examples` フォルダー自体を Zed のプロジェクトとして開きます。
5. `width.txt` の `ABC123` を選択し、Code Actions（通常 `Ctrl+.`）から「英数字を全角に変換」を実行します。
6. 前後の日本語・絵文字が保持されること、Undo で戻せること、未保存で加筆した文字も変換できることを確認します。

別のフォルダーで利用する場合は生成された設定をそのフォルダーの `.zed/settings.json` に、
全フォルダーで利用する場合は Zed のユーザー設定に、既存設定を保持して統合します。
生成されたパスはローカル専用です。共有する設定ファイルにはコピーしないでください。
接続先や設置先の作業メモは Git 対象外の `*.local.md` に保存します。

サーバーは UTF-16 を明示し、バージョン付き編集を返します。選択後に文書が変更された場合、
resolve 時点で変換を中止します。候補解決に対応しないクライアントには純粋なローカル変換のみ即時編集を返します。
将来の DeepL のような副作用を持つ機能は候補表示時に実行しない設計とします。
`workspace.workspaceEdit.documentChanges` 非対応のクライアントには変換候補を返しません。

自動テストは stdio LSP を通して未保存の増分編集、絵文字・結合文字を含む位置、
古い候補の拒否、無選択、対象外アクションを検証します。
ユーザーから、Linux の多言語対応版 Zed 1.20.2 上で初期変換が正常に動作することを確認済みとの報告を受けています。
Undo など各操作の個別の確認結果は未記録です。

## 次の段階

### 検証用の診断

同じサーバーで「要確認」を情報レベルで指摘する接続検証用の機能を追加しました。
本格的な日本語校正ではなく、初期状態では無効です。Zed の
`lsp` → `text-tools` に以下を追加し、言語サーバーを再起動すると有効になります。

```json
"initialization_options": {
  "conversion": true,
  "diagnostics": { "enabled": true, "word": "要確認" }
}
```

`conversion` と `diagnostics.enabled` は独立しています。設定変更は再起動後に反映されます。
診断は入力停止から200ms後に検査し、文書ごとに最大100件を表示します。
対象語を削除すると指摘を消去し、文書の変更・クローズ後に到着した結果は破棄します。
検査エンジンは LSP に依存せず、UTF-16 の開始・終了オフセット（終了位置を含まない）を返します。

任意のフォルダーで `.txt` を開き、`日本😀é 要確認 ABC123` を入力して、
「要確認」の指摘と英数字の変換が両立することを確認してください。
「要確認」を削除した際に指摘が消えることも確認します。
プロジェクト側で言語サーバーの設定を上書きしている場合は、その設定が優先されます。

ユーザー設定による任意フォルダーでの利用 → 単純な診断の接続 → 変換機能の拡充 →
サーバー配布の整備 → 本格校正 → DeepL の順に進めます。
詳しい完了条件は [設計方針](docs/architecture.md) に記載しています。

## 技術選定の根拠

2026-09-18 に元校正拡張の次のファイルを確認しました。

- [package.json](https://github.com/niikei/japanese-proofreading-info/blob/master/package.json): textlint、preset-japanese、preset-jtf-style、prh、ICS MEDIA のルールセット、vscode-languageserver を利用。
- [rule.ts](https://github.com/niikei/japanese-proofreading-info/blob/master/src/rules/rule.ts): 日本語・JTF・辞書ルールへの設定対応と独自 severity の指定。
- [LICENSE.txt](https://github.com/niikei/japanese-proofreading-info/blob/master/LICENSE.txt): 拡張本体は MIT、Copyright 2018 ICS INC.。

将来の textlint 接続を容易にするため Node.js と `vscode-languageserver` を採用しました。
初期版は既知の LSP 3.17 系ライブラリ 9.0.1 に固定しています。
元拡張のコードや校正ルールはまだ取り込んでいません。
個々のルール・辞書のライセンスとバージョンは、校正接続時に別途確認します。
本プロジェクト自体の公開ライセンスは未決定です。
