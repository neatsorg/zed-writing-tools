# Zed Text Tools

開発初期版。`.txt`（Zed の `Plain Text`）に対して 2 つの機能を提供します。

- 変換拡張: 選択範囲の英数字・英字・数字・記号・半角カナ／全角カナ、ひらがな／カタカナを変換します
  （空白は記号変換の対象外、無選択時は何もしません）。
- 校正拡張: textlint（preset-japanese）による日本語校正を情報レベルの診断として表示します。

## 構造

- `src/engines/width.js`: 半角／全角の変換。文字列 → 文字列の純粋関数。LSP・Zed に依存しません。
- `src/engines/kana.js`: ひらがな／カタカナの変換。同様に純粋関数。
- `src/engines/proofread.js`: textlint（preset-japanese）による校正。同様に純粋な文字列入出力で、
  LSP・Zed に依存しません。
- `src/features/conversion.js`: 変換の機能 ID・表示名・変換関数の登録。
- `src/features/proofreading.js`: 校正の機能登録。
- `src/lsp/create-server.js`: 文書同期、UTF-16 位置、Code Action、Diagnostics を扱う LSP サーバー本体。
  `{ transformations, inspections }` を受け取り、拡張ごとに異なる機能サブセットで起動できます。
- `src/lsp/server.js`: 変換拡張のエントリーポイント。`src/lsp/proofreading-server.js`: 校正拡張のエントリーポイント。
- `extension/`: 変換用の Zed 拡張（ID: `text-tools`）。
  `extension-proofreading/`: 校正用の Zed 拡張（ID: `text-tools-proofreading`）。

変換拡張は校正エンジン（textlint）を import しないため、その依存を読み込みません。
拡張は変換用・校正用に分かれていますが、LSP サーバー本体とエンジンは共通コードです。

半角カナ／全角カナ、ひらがな／カタカナの変換は [jaconv](https://github.com/kazuhikoarase/jaconv)
（MIT、依存なし）を利用します。半角カナの濁点・半濁点の結合（`ｶﾞ` ↔ `ガ`）は同ライブラリに委ねます。
英数字・記号は自前のテーブルで変換し、記号変換は英数字・空白を対象外にします。

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
7. 同ファイル末尾の英字・数字・記号・カナ・ひらがな／カタカナのサンプルも選択して、
   対応する Code Action（「英字を全角に変換」「記号を半角に変換」など）が個別に変換できることを確認します。
   記号変換では空白が変換されないこと、カナ変換では濁点・半濁点が結合されることも確認します。

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

### サーバー配布物と固定パスの解消

Zed 拡張は `lsp.text-tools.binary.path`／`arguments` の明示設定を優先しますが、
未設定の場合は次のように自動解決します。

- Node 実行パス: Zed が使う Node（`node_binary_path()`）。
- サーバー本体: 拡張の作業ディレクトリ（`~/.local/share/zed/extensions/work/<拡張 ID>/` など）
  配下の配布物（変換拡張は `text-tools-server/<version>/src/lsp/server.js`、
  校正拡張は `text-tools-proofreading-server/<version>/src/lsp/proofreading-server.js`）。

これにより、プロジェクトをどこに置いたか・`node` がどこにあるかに依存せず起動できます。
変換拡張・校正拡張は依存が異なる（校正拡張のみ textlint 系を持つ）ため、配布物も対象別に
生成します。`build:server-dist`／`deploy:server-dev` は対象名（`conversion` または
`proofreading`）を引数に取ります。

```sh
npm run build:server-dist -- conversion    # dist/text-tools-server/<version>/ を生成
npm run deploy:server-dev -- conversion    # 変換拡張の作業ディレクトリへ配置

npm run build:server-dist -- proofreading  # dist/text-tools-proofreading-server/<version>/ を生成
npm run deploy:server-dev -- proofreading  # 校正拡張の作業ディレクトリへ配置
```

配置後、Zed の設定に `lsp.text-tools.binary`／`lsp.text-tools-proofreading.binary` を
書かなければ自動解決されます（`npm run setup:example` が生成する設定は変換拡張の `binary` を
明示するので、そちらを使う場合はプロジェクト内の `src/` を直接参照します。コード変更を都度
配布物に反映せず素早く試したいときに向いています）。設定変更後、または配布物を再生成・再配置
した後は言語サーバーの再起動（コマンドパレット: `zed: restart language server`）が必要です。

生成物・アーカイブは Git 対象外です。クローンした環境では上記コマンドで再生成できます。
公開先が決まった後は、同じ生成手順を CI で実行し、拡張が起動時に GitHub Releases から
同じ構成の配布物を取得・展開する処理を追加する予定です（未実装）。詳細は
[設計方針](docs/architecture.md) を参照してください。

### 校正拡張（textlint 接続）

`extension-proofreading/`（ID: `text-tools-proofreading`）が `src/engines/proofread.js` を
`.txt` に対して実行し、情報レベルの診断として返します。ルールは
[textlint-rule-preset-japanese](https://github.com/textlint-ja/textlint-rule-preset-japanese)
の全 12 ルール（誤検知が少ないことを方針として明言するプリセット）。このうち文単位で解析する
5 ルール（max-ten・no-doubled-conjunctive-particle-ga・no-doubled-conjunction・
no-doubled-joshi・sentence-length）は文書サイズに対して超線形に遅くなるため、
文書が 30000 字（UTF-16 コードユニット数）を超える場合はスキップします
（詳細は [調査記録](docs/textlint-research.md)）。

校正拡張は変換の Code Action を提供しません（`transformations: []`）。逆に変換拡張は
`inspections: []` で、校正エンジン（textlint）を import しないため依存を読み込みません。
両拡張は別の言語サーバー ID（`text-tools`／`text-tools-proofreading`）を持つため、
同時に導入しても機能は重複しません。

`src/lsp/diagnostics.js` は、文書ごとの検査の集約・古い結果の破棄・診断の消去・失敗時の
復帰を扱う LSP アダプターで、校正エンジンとは独立してテストされています
（`test/server.test.js` が `test/fixtures/` のテスト専用ダミー検査エンジンを注入して検証。
製品コードにテスト用の分岐は追加していません）。

ここまで（任意フォルダーでの利用・変換機能の拡充・サーバー配布の整備・拡張分割・
校正エンジンの接続）を実施済みです。次は DeepL の接続に進みます。
詳しい完了条件は [設計方針](docs/architecture.md) に記載しています。

## 技術選定の根拠

2026-09-18 に元校正拡張の次のファイルを確認しました。

- [package.json](https://github.com/niikei/japanese-proofreading-info/blob/master/package.json): textlint、preset-japanese、preset-jtf-style、prh、ICS MEDIA のルールセット、vscode-languageserver を利用。
- [rule.ts](https://github.com/niikei/japanese-proofreading-info/blob/master/src/rules/rule.ts): 日本語・JTF・辞書ルールへの設定対応と独自 severity の指定。
- [LICENSE.txt](https://github.com/niikei/japanese-proofreading-info/blob/master/LICENSE.txt): 拡張本体は MIT、Copyright 2018 ICS INC.。

将来の textlint 接続を容易にするため Node.js と `vscode-languageserver` を採用しました。
初期版は既知の LSP 3.17 系ライブラリ 9.0.1 に固定しています。
本プロジェクト自体の公開ライセンスは未決定です。

校正エンジンには [textlint](https://github.com/textlint/textlint) と
[textlint-rule-preset-japanese](https://github.com/textlint-ja/textlint-rule-preset-japanese)
（いずれも MIT、npm 公開）のみを採用しました。元拡張が使う `preset-jtf-style`・`prh`・
ICS MEDIA 辞書（`textlint-rule-preset-icsmedia`、GitHub 直接参照で npm 未公開）は初回は見送り。
`preset-japanese` は「誤検知が少ないルールに限定し、スタイル系ルールは含めない」という方針を
明言しており、依存管理・ライセンスの明確さの両方で初回採用に適していました。調査の詳細は
[docs/textlint-research.md](docs/textlint-research.md) を参照してください。
校正拡張の配布物に含まれる全依存（推移的依存を含む242パッケージ）のライセンスは
`THIRD_PARTY_NOTICES` に記録されます（LICENSE ファイルが同梱されていないパッケージは、
`package.json` の SPDX ライセンス識別子から標準ライセンス文で補います。
`scripts/build-server-dist.js` 参照）。

半角カナ／全角カナ、ひらがな／カタカナの変換には
[jaconv 1.1.2](https://github.com/kazuhikoarase/jaconv)（MIT、Copyright (c) 2016 Kazuhiko Arase、
依存パッケージなし、2025-06-27 公開）を採用しました。濁点・半濁点の結合を伴う半角カナ変換の
無差別な自作実装は誤りやすいため、テーブルを持つ既存実装を再利用する判断です。
英字・数字・記号は既存の英数字変換と同じ方式（コードポイントのオフセット、記号は
jaconv の ASCII テーブルを 1 文字ずつ適用）で自前実装し、英数字・空白は記号変換の対象外にしています。
