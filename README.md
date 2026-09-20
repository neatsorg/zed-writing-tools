# Zed Writing Tools

開発初期版。`.txt`（Zed の `Plain Text`）に対して 3 つの機能を提供する拡張機能です。
以下のすべて、またはそれぞれを個別の拡張機能としてインストール可能です。

- 半角・全角の変換: 選択範囲の英数字・英字・数字・記号・半角カナ／全角カナ、ひらがな／カタカナを変換します。  
機序はVSCodeの[Zenkaku-Hankaku](https://github.com/mo-san/Zenkaku-Hankaku)を参考にさせていただきました。多謝。
- 日本語の校正: textlint（preset-japanese）による日本語校正を情報レベルの診断として表示します。  
機序はVSCodeの[テキスト校正くん](https://github.com/ics-creative/project-japanese-proofreading)を参考にさせていただきました。多謝。
- DeepL翻訳: 選択範囲を DeepL API で翻訳し置き換えます（APIキーが必要）。

## 未保存の文書への対応状況

一度でも`.txt`として保存済みのファイルに対する加筆・修正であれば、未保存のバッファがあっても LSP の
文書同期でサーバーに届くため、この拡張機能で処理対象にできます。上書き保存せずに利用できます。

ただし、一度も保存していない `Untitled` の新規タブは別扱いです。2026-09-20 に確認した
[Zed の実装](https://github.com/zed-industries/zed/blob/main/crates/project/src/lsp_store.rs)では、
ファイルに紐づかないバッファは言語サーバーへ登録されません。
（`register_buffer_with_language_servers`）。言語を `Plain Text` に選び直すだけでは
この制約を解消できません。こちらのサーバーはディスクから本文を読む必要がありませんが、
Zed から文書が届く必要があります。これはソース上の確認であり、利用中の Zed での実機確認は未実施です。

この LSP 制約とは別に、Zed 自体には未保存本文を保存・復元する機能があります。
自動言語判定の無効化、Hot Exit の改善 PR、固定名の永続メモを実現する案は
[未保存文書・永続メモの調査](docs/scratch-buffer-research.md)にまとめています。
現状でこの不便を解消するために、[Zed 自体の拡張可能性を鑑みたパッチ](https://github.com/neatsorg/zed-scratch-buffers)として
まとめています。
そちらと併用すると、現状でも未保存な文書でこれら拡張機能の処理対象にできます。
詳しくはそちらをご覧ください。

プレーンテキスト以外の形式への対応方針は[設計方針](docs/architecture.md#対応形式と校正方法)を参照してください。

## 構造

- `src/engines/width.js`: 半角／全角の変換。文字列 → 文字列の純粋関数。LSP・Zed に依存しません。
- `src/engines/kana.js`: ひらがな／カタカナの変換。同様に純粋関数。
- `src/engines/proofread.js`: textlint（preset-japanese）による校正。同様に純粋な文字列入出力で、
  LSP・Zed に依存しません。
- `src/engines/deepl.js`: DeepL API による翻訳。同様に LSP・Zed に依存しない文字列入出力
  （`translate(text, targetLang, signal)`）。認証・通信・エラー分類をここに閉じます。
- `src/features/conversion.js`: 変換の機能 ID・表示名・変換関数の登録。
- `src/features/proofreading.js`: 校正の機能登録。
- `src/features/translation.js`: 翻訳の機能登録（対象言語ごとの Code Action・サイズ上限）。
- `src/lsp/create-server.js`: 文書同期、UTF-16 位置、Code Action、Diagnostics、翻訳の実行
  （`workspace/executeCommand`）を扱う LSP サーバー本体。`{ transformations, inspections, translations }`
  を受け取り、拡張ごとに異なる機能サブセットで起動できます。
- `src/lsp/server.js`: 変換拡張のエントリーポイント。`src/lsp/proofreading-server.js`: 校正拡張の
  エントリーポイント。`src/lsp/translation-server.js`: 翻訳拡張のエントリーポイント。
- `extension-conversion/`: 変換用の Zed 拡張（ID: `writing-tools-conversion`）。
  `extension-proofreading/`: 校正用の Zed 拡張（ID: `writing-tools-proofreading`）。
  `extension-translation/`: 翻訳用の Zed 拡張（ID: `writing-tools-translation`）。

各拡張は他の機能のエンジンを import しないため、それぞれ無関係な依存を読み込みません
（変換拡張は textlint・DeepL 通信のコードを読み込まない、翻訳拡張は textlint を読み込まない、等）。
拡張は機能ごとに分かれていますが、LSP サーバー本体とエンジンは共通コードです。

半角カナ／全角カナ、ひらがな／カタカナの変換は [jaconv](https://github.com/kazuhikoarase/jaconv)
（MIT、依存なし）を利用します。半角カナの濁点・半濁点の結合（`ｶﾞ` ↔ `ガ`）は同ライブラリに委ねます。
英数字・記号は自前のテーブルで変換し、記号変換は英数字・空白を対象外にします。

共通サーバーに機能を追加する構成です。サーバーの標準入出力は標準 LSP であり、
他のエディタからも起動できます。変換エンジンは単独で取り出せます。
任意コマンドや動的プラグインの実行機構は導入していません。

責務の境界、開発順序、単一リポジトリでの管理方針は [設計方針](docs/architecture.md) を参照してください。

## 導入（開発版）

現在はサーバー配布物を自動取得しません。リポジトリを取得した環境で、各サーバーを
生成してから Zed に3つの開発用拡張を個別にインストールします。

```sh
npm ci --ignore-scripts
npm run patch:deps
npm run build:server-dist -- conversion
npm run deploy:server-dev -- conversion
npm run build:server-dist -- proofreading
npm run deploy:server-dev -- proofreading
npm run build:server-dist -- translation
npm run deploy:server-dev -- translation
```

Zed のコマンドパレットで `zed: install dev extension` を実行し、次のディレクトリから
文字列変換、校正、翻訳のうちインストールしたい機能のものを選びます。すべて選べば、全拡張機能がインストールされます。

```text
extension-conversion/
extension-proofreading/
extension-translation/
```

導入後は `.txt` ファイルを開くと各機能を利用できます。翻訳を使う場合は、Zed を起動する
環境に `DEEPL_AUTH_KEY`（または `DEEPL_AUTH_KEY_OP_REF`）を設定してください。サーバーの
再生成・再配置や設定変更後は `zed: restart language server` を実行します。これは開発版の
導入手順であり、リリース配布物や自動更新の仕組みはまだありません。

## 開発

Node.js 22 以降、Rust と `wasm32-wasip2` ターゲットを使用します。

```sh
npm ci --ignore-scripts
npm run patch:deps
npm test
cargo build --manifest-path extension-conversion/Cargo.toml --target wasm32-wasip2 --release --locked
```

## Zed での動作確認

1. このプロジェクトを任意の場所に置き、`npm ci --ignore-scripts` と `npm run patch:deps` を実行します。
2. `npm run setup:example` を実行します。現在の Node.js 実行パスとプロジェクトの
   配置先から、Git 対象外の `examples/.zed/settings.json` を生成します。
   既存ファイルは上書きしません。配置先を移動した場合は、既存設定を退避して再生成してください。
3. 「導入（開発版）」の手順で3つのサーバー配布物を生成・配置し、Zed の
   `zed: install dev extension` で `extension-conversion/`、`extension-proofreading/`、
   `extension-translation/` をそれぞれ選びます。ビルドには Rust と `wasm32-wasip2`
   ターゲットが必要です。
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

Zed 拡張は `lsp.writing-tools-conversion.binary.path`／`arguments` の明示設定を優先しますが、
未設定の場合は次のように自動解決します。

- Node 実行パス: Zed が使う Node（`node_binary_path()`）。
- サーバー本体: 拡張の作業ディレクトリ（`~/.local/share/zed/extensions/work/<拡張 ID>/` など）
  配下の配布物（変換拡張は `writing-tools-conversion-server/<version>/src/lsp/server.js`、
  校正拡張は `writing-tools-proofreading-server/<version>/src/lsp/proofreading-server.js`）。

これにより、プロジェクトをどこに置いたか・`node` がどこにあるかに依存せず起動できます。
変換拡張・校正拡張は依存が異なる（校正拡張のみ textlint 系を持つ）ため、配布物も対象別に
生成します。`build:server-dist`／`deploy:server-dev` は対象名（`conversion` または
`proofreading`）を引数に取ります。

```sh
npm run build:server-dist -- conversion    # dist/writing-tools-conversion-server/<version>/ を生成
npm run deploy:server-dev -- conversion    # 変換拡張の作業ディレクトリへ配置

npm run build:server-dist -- proofreading  # dist/writing-tools-proofreading-server/<version>/ を生成
npm run deploy:server-dev -- proofreading  # 校正拡張の作業ディレクトリへ配置

npm run build:server-dist -- translation   # dist/writing-tools-translation-server/<version>/ を生成
npm run deploy:server-dev -- translation   # 翻訳拡張の作業ディレクトリへ配置
```

配置後、Zed の設定に `lsp.writing-tools-conversion.binary`／`lsp.writing-tools-proofreading.binary`／
`lsp.writing-tools-translation.binary` を書かなければ自動解決されます（`npm run setup:example` が
生成する設定は変換拡張の `binary` を明示するので、そちらを使う場合はプロジェクト内の `src/` を
直接参照します。コード変更を都度配布物に反映せず素早く試したいときに向いています）。
設定変更後、または配布物を再生成・再配置した後は言語サーバーの再起動
（コマンドパレット: `zed: restart language server`）が必要です。

生成物・アーカイブは Git 対象外です。クローンした環境では上記コマンドで再生成できます。
公開先が決まった後は、同じ生成手順を CI で実行し、拡張が起動時に GitHub Releases から
同じ構成の配布物を取得・展開する処理を追加する予定です（未実装）。詳細は
[設計方針](docs/architecture.md) を参照してください。

### 機能ごとの設定（項目・ルール単位の有効・無効）

3 拡張とも、`.zed/settings.json` の `lsp.<拡張 ID>.initialization_options` に設定を書きます。
専用の設定 GUI は提供していません。Zed の公開拡張 API（2026-09 時点）には、拡張が独自の
設定フォームや JSON Schema を提示する仕組みが無く
（[zed-industries/zed#60648](https://github.com/zed-industries/zed/discussions/60648) で
Configure UI が提案されたが、対応する [PR #60653](https://github.com/zed-industries/zed/pull/60653)
はスクリーンショット等が無いまま 2026-07-09 にクローズ済み）、`settings.json` の直接編集が
現状の唯一の手段です。設定変更後は言語サーバーの再起動
（コマンドパレット: `zed: restart language server`）が必要です。

無効化は表示を隠すだけでなく実行そのものを止めます（変換は該当項目を Code Action の候補から
外して実行せず、校正はルールを textlint のカーネルへ渡す前に除外し、DeepL は
`workspace/executeCommand` の実行時にも無効化設定を確認して外部送信そのものを止めます）。

**変換拡張**（`lsp.writing-tools-conversion.initialization_options`）:

```json
{
  "conversion": {
    "enabled": true,
    "items": {
      "width.full.alphanumeric": true,
      "width.half.symbol": false
    }
  }
}
```

`enabled: false` で拡張全体を無効化します。`items` は個別の変換項目（Code Action の内部 ID）を
`false` にしたものだけを無効化し、指定しなかった項目・`true` にした項目は有効のままです。
ID は `src/features/conversion.js` の一覧（`width.full.alphanumeric`・`width.half.alphanumeric`・
`width.full.alpha`・`width.half.alpha`・`width.full.digit`・`width.half.digit`・
`width.full.symbol`・`width.half.symbol`・`width.full.kana`・`width.half.kana`・
`kana.hiragana`・`kana.katakana`）を参照してください。

**校正拡張**（`lsp.writing-tools-proofreading.initialization_options`）:

```json
{
  "diagnostics": {
    "enabled": true,
    "rules": {
      "no-dropping-the-ra": false
    }
  }
}
```

`rules` は [preset-japanese](https://github.com/textlint-ja/textlint-rule-preset-japanese) の
ルール名（例: 「ら抜き表現を指摘するか」に対応する `no-dropping-the-ra`）をキーにし、`false` に
したルールだけをスキップします。診断メッセージ末尾の `（preset-japanese/<ルール名>）` がそのまま
キーに使えます。文書サイズが 30000 字を超えた場合の重いルールの自動スキップ（下記）とは独立に働き、
両方の条件に該当するルールは当然実行されません。

**翻訳拡張**（`lsp.writing-tools-translation.initialization_options`）:

```json
{
  "translation": {
    "enabled": true,
    "items": {
      "deepl.en": false
    }
  }
}
```

`items` は翻訳先言語ごとの Code Action（`deepl.ja`・`deepl.en`）を個別に無効化します。
`enabled: false`（既存）は翻訳機能全体を無効化し、`workspace/executeCommand` の
`executeCommandProvider` 自体を宣言しません。

### 校正拡張（textlint 接続）

`extension-proofreading/`（ID: `writing-tools-proofreading`）が `src/engines/proofread.js` を
`.txt` に対して実行し、情報レベルの診断として返します。診断は既定で有効です
（`initialization_options.diagnostics.enabled: false` で無効化できます）。ルールは
[textlint-rule-preset-japanese](https://github.com/textlint-ja/textlint-rule-preset-japanese)
の全 12 ルール（誤検知が少ないことを方針として明言するプリセット）。プロジェクトの
`.textlintrc` 等は探索・読み込みません（同梱ルールのみで動作します）。

このうち文単位で解析する 5 ルール（max-ten・no-doubled-conjunctive-particle-ga・
no-doubled-conjunction・no-doubled-joshi・sentence-length）は文書サイズに対して超線形に
遅くなるため、文書が 30000 字（UTF-16 コードユニット数）を超える場合はスキップします。
絵文字や「𠮷」を含む文書でも形態素解析系の 7 ルールを実行します。
kuromoji 0.1.2 への[固定パッチ](patches/README.md)で、トークン位置を UTF-16 にそろえ、
連続するサロゲートペアを未知語としてまとめた際の長さ計算も修正しています。
原文の置換や最終診断位置の一律変換は行いません。

パッチは通常の npm インストール、`npm test`、`npm start` と校正配布物のビルドで適用します。
`npm ci --ignore-scripts` の直後にサーバーを直接起動する場合は、先に `npm run patch:deps` を
実行してください。未適用の校正サーバーは説明付きエラーで停止します。
依存更新で対象バージョンやソースが変わった場合も、自動適用を止めて再確認を求めます。

校正拡張は変換の Code Action を提供しません（`transformations: []`）。逆に変換拡張は
`inspections: []` で、校正エンジン（textlint）を import しないため依存を読み込みません。
両拡張は別の言語サーバー ID（`writing-tools-conversion`／`writing-tools-proofreading`）を持つため、
同時に導入しても機能は重複しません。

`src/lsp/diagnostics.js` は、文書ごとの検査の集約・古い結果の破棄・診断の消去・失敗時の
復帰を扱う LSP アダプターで、校正エンジンとは独立してテストされています
（`test/server.test.js` が `test/fixtures/` のテスト専用ダミー検査エンジンを注入して検証。
製品コードにテスト用の分岐は追加していません）。

### 翻訳拡張（DeepL 接続）

`extension-translation/`（ID: `writing-tools-translation`）が選択範囲を DeepL API で翻訳し、
その場で置き換えます。「DeepLで日本語に翻訳」「DeepLで英語に翻訳」（`EN-US`）の 2 つの
Code Action を提供します。翻訳元言語は DeepL 側の自動判定に任せます（`source_lang` を送りません）。

**候補を表示するだけでは通信しません。** Code Action の一覧（`textDocument/codeAction`）には
実行内容（LSP の `command`）だけを持たせ、実際の翻訳・DeepL への送信は、ユーザーがその
Code Action を選択したときに送られる `workspace/executeCommand` の中でのみ行います
（`src/lsp/create-server.js`）。変換のローカル処理と違い、副作用（外部送信・課金）を伴うため、
この 2 つの経路を明確に分けています。翻訳は既定で有効です
（`initialization_options.translation.enabled: false` で無効化できます）。

**APIキーの設定**: 環境変数 `DEEPL_AUTH_KEY` にご自身の DeepL APIキーを設定してから
言語サーバー（Zed）を起動してください。`.zed/settings.json` やこのリポジトリにキーを
書き込まないでください（`.env`／`.env.*` は Git 対象外です。変数名の見本として
`.env.example` を用意していますが、実際の値はここにも書きません）。キー未設定のまま
翻訳を実行すると、設定方法を案内するメッセージを表示します（サーバー自体は起動します）。
送信先 URL はキー形式（Free プランは `:fx` で終わる）から自動判定し、固定です。設定で
変更することはできません。

Zed 公式ドキュメント（[Zed の環境変数について](https://zed.dev/docs/environment)）によれば、
デスクトップランチャー等の GUI から起動した場合、Zed はホームディレクトリで**ログインシェルを
起動してその環境変数を読み取り**ます。zsh の場合、ログインシェルが読むのは `.zshenv`・
`.zprofile` で、対話シェル専用の `.zshrc` は読まれないことがあります。GUI 起動でも確実に
届けたい場合は **`.zshrc` ではなく `.zprofile`**（または OS 側の `~/.config/environment.d/`）に
設定してください。

**1Password 等のシークレット管理ツールと組み合わせる場合**: `DEEPL_AUTH_KEY` の代わりに
`DEEPL_AUTH_KEY_OP_REF` に 1Password の参照文字列（例:
`op://Personal/<item>/<field>`。これ自体は秘密ではありません）を設定できます。この変数は
非機密なので `.zprofile` に無条件で書いて構いません。実際の 1Password 認証（`op read` の実行）は
**翻訳の Code Action を初めて実行した瞬間**まで遅延し、成功した値はその言語サーバープロセスが
生きている間だけメモリに保持して使い回します（エディタ起動のたびに認証を求めると、翻訳を
使わないセッションでも毎回認証が挟まってしまうため、あえて使用時まで遅延させています）。
`DEEPL_AUTH_KEY` が設定されている場合はそちらを優先し、`op` は呼びません。
[1Password CLI](https://developer.1password.com/docs/cli/) (`op`) がインストール・認証済みで
`PATH` 上にある必要があります。

**DeepL への送信について**: 選択した範囲のテキストは DeepL のサーバーへ送信されます。
利用料金・上限、無料／有料プランごとのデータ取り扱いの違いは
[DeepL API の利用規約](https://www.deepl.com/en/pro-license)・
[プライバシーポリシー](https://www.deepl.com/en/privacy)を確認してください。本プロジェクトの
GPLv3 ライセンス（下記「ライセンス」節）とは別に、DeepL サービス自体の利用条件が適用されます。

選択範囲のサイズは二段階で確認します。まず選択直後に生テキストのバイト数（約 100000 バイト）で
早期に弾き（`src/lsp/create-server.js`。1Password 解決や通信を試みる前の安価なフィルタ）、
次に実際に送信する JSON 本文のバイト数（約 120000 バイト）でも確認します（`src/engines/deepl.js`）。
引用符や改行を多く含む原文は JSON エスケープで本文が膨らむため、後者が実質的な上限です
（DeepL の 128KiB 制限に対する安全マージン）。自動分割は行いません。翻訳中に文書が変更された
場合は結果を破棄します。`workspace/applyEdit` がクライアント側の都合で `applied: false` を
返した場合も、黙って捨てず案内します（自動での再翻訳はしません）。同一文書への多重実行は
抑止します。翻訳の無効化（`initialization_options.translation.enabled: false`）は候補の
非表示だけでなく、`workspace/executeCommand` の実行時にも確認します。エラー（認証失敗・
利用上限・混雑・タイムアウト・キー未設定・1Password 解決失敗等）は種別ごとに案内し、
原文・訳文・APIキーはログに出しません。

ここまで（任意フォルダーでの利用・変換機能の拡充・サーバー配布の整備・拡張分割・
校正エンジンの接続・DeepL 翻訳の接続）を実施済みです。実機での DeepL 接続確認（GUI 起動時の
環境変数到達、実キーでの動作、Undo の確認）はユーザー確認待ちです。
詳しい完了条件は [設計方針](docs/architecture.md) に記載しています。

## 技術選定の根拠

2026-09-18 に元校正拡張の次のファイルを確認しました。

- [package.json](https://github.com/niikei/japanese-proofreading-info/blob/master/package.json): textlint、preset-japanese、preset-jtf-style、prh、ICS MEDIA のルールセット、vscode-languageserver を利用。
- [rule.ts](https://github.com/niikei/japanese-proofreading-info/blob/master/src/rules/rule.ts): 日本語・JTF・辞書ルールへの設定対応と独自 severity の指定。
- [LICENSE.txt](https://github.com/niikei/japanese-proofreading-info/blob/master/LICENSE.txt): 拡張本体は MIT、Copyright 2018 ICS INC.。

将来の textlint 接続を容易にするため Node.js と `vscode-languageserver` を採用しました。
初期版は既知の LSP 3.17 系ライブラリ 9.0.1 に固定しています。
本プロジェクト自体の公開ライセンスは GPL-3.0-or-later です（詳細は末尾の「ライセンス」節）。

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

DeepL への通信には、公式 SDK（[deepl-node](https://github.com/DeepL/deepl-node)、MIT）ではなく
Node 標準の `fetch`／`AbortSignal` を直接使う実装を採用しました。初版はテキスト翻訳
（`/v2/translate`）1 エンドポイントしか使わないため、追加の npm 依存とその推移的依存のライセンス
監査を増やさずに実装できます。将来 SDK が提供する機能（用語集、文書翻訳等）が必要になれば、
その時点で deepl-node への切り替えを検討します。

## ライセンス

Copyright (C) 2026 Sayawaka

本プロジェクト（`extension-conversion/`・`extension-proofreading/`・`extension-translation/`・`src/`・`scripts/` 以下の
オリジナルコード）は [GNU General Public License v3.0 以降](LICENSE)（GPL-3.0-or-later）の
もとで配布します。全文は [`LICENSE`](LICENSE) を参照してください。

3種類のサーバー配布物にも `LICENSE` と本 `README.md` を同梱し、ライセンス本文と
著作権・GPL-3.0-or-later の適用表示を保持します。

```
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
```

同梱する npm・Cargo の依存（サーバー配布物・Wasm 拡張が使う third-party パッケージ）は、
それぞれ MIT・Apache-2.0・BSD 系など元のライセンスのまま保持します。GPLv3 とは別の
条件のまま個別に表示する必要があるため、GPLv3 化したとは表示しません。配布物ごとの
一覧・ライセンス全文は各配布物の `THIRD_PARTY_NOTICES`（生成: `npm run build:server-dist`、
`npm run build:rust-notices`）に記録されます。校正拡張が同梱する mecab-ipadic 辞書は
NAIST-2003 条件の独立データで、これも GPLv3 化の対象に含めていません
（詳細は [docs/license-audit.md](docs/license-audit.md)）。

### Corresponding Source（対応するソース）

GPLv3 で必須となる「対応するソース」は本リポジトリそのものです。ビルド対象の全ソース
（`extension-conversion/`・`extension-proofreading/`・`extension-translation/`・`src/`）、依存バージョンを固定する
`package-lock.json`・`Cargo.lock`、kuromoji 0.1.2 への[固定パッチ](patches/README.md)、
配布物を再現するビルド手順（本 README の「開発」節・「サーバー配布物と固定パスの解消」節）を
すべて追跡しています。`dist/` 自体は生成物のため Git 対象外ですが、上記の手順で
同一内容を再生成できます。リリースを GitHub Releases 等で配布する場合は、各リリースが
対応するコミット／タグの本リポジトリの内容と一致するようにします。

配布形態ごとの確認と、依存ソース・Rust標準ライブラリ通知を含むリリース手順は
[docs/release-licensing.md](docs/release-licensing.md)を参照してください。
