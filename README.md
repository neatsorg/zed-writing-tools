# Zed Writing Tools

開発初期版。Zed 上で拡張子`.txt`を持つ `Plain Text`に対して、 3 つの機能を提供する拡張機能です。  
Zed での、とりわけ日本語の文書の入力・編集を支援するために作られました。  

以下のすべて、またはそれぞれを個別の拡張機能としてインストール可能です。
機能はZed のコードアクション（通常 `Ctrl+.`）として実行できます。

- 半角・全角の変換: 選択範囲の英数字・英字・数字・記号・半角カナ／全角カナ、ひらがな／カタカナを変換します。  
機序はVSCodeの[Zenkaku-Hankaku](https://github.com/mo-san/Zenkaku-Hankaku)を参考にさせていただきました。多謝。
- 日本語の校正: textlint（preset-japanese）による日本語校正を情報レベルの診断として表示します。  
機序はVSCodeの[テキスト校正くん](https://github.com/ics-creative/project-japanese-proofreading)を参考にさせていただきました。多謝。
- DeepL翻訳: 選択範囲を DeepL API で翻訳し置き換えます（APIキーが必要）。

## 未保存の文書への対応状況

一度でも`.txt`として保存済みのファイルに対する加筆・修正であれば、未保存のバッファがあっても LSP の
文書同期でサーバーに届くため、この拡張機能で処理対象にできます。つまり上書き保存せずに機能を使うことができます。

ただし、一度も保存していない `Untitled` の新規タブは別扱いです。2026-09-20 に確認した
[Zed の実装](https://github.com/zed-industries/zed/blob/main/crates/project/src/lsp_store.rs)によると、
ファイルに紐づかないバッファは言語サーバーへ登録されません。よってこれらの拡張機能が処理できません（`register_buffer_with_language_servers`）。
この制約は言語を `Plain Text` に選び直すだけでは解消できず、ファイルとしての保存が必要になります。

上記を踏まえつつ、ひとまず現状でこの不便を解消するために未保存バッファをバックグラウンドで`.txt`ファイルに保存し、
LSPの機能が使えるようにした[Zed 本体へのパッチ](https://github.com/neatsorg/zed-scratch-buffers)をまとめました。
そちらと併用すると、現状でも、未保存文書をこれらの拡張機能で処理対象にできます。
詳しくはそちらをご覧ください。

またプレーンテキスト以外の形式への対応方針は[設計方針](docs/architecture.md#対応形式と校正方法)を参照してください。

## 導入（開発版）

現在、本プログラムは開発初期版であり、サーバー配布物を自動取得しません。本リポジトリをclone取得した環境で各サーバーを
生成してください。

`build:server-dist`／`deploy:server-dev` は対象名（`conversion``proofreading` など）を引数に取ります。
```sh
npm ci --ignore-scripts
npm run patch:deps
npm run build:server-dist -- conversion    # dist/writing-tools-conversion-server/<version>/ を生成
npm run deploy:server-dev -- conversion    # 変換拡張の作業ディレクトリへ配置
npm run build:server-dist -- proofreading  # dist/writing-tools-proofreading-server/<version>/ を生成
npm run deploy:server-dev -- proofreading  # 校正拡張の作業ディレクトリへ配置
npm run build:server-dist -- translation   # dist/writing-tools-translation-server/<version>/ を生成
npm run deploy:server-dev -- translation   # 翻訳拡張の作業ディレクトリへ配置
```

サーバー生成が終わったら、Zed に3つの開発用拡張を個別に導入します。
Zed のコマンドパレットで `zed: install dev extension` を実行し、次のディレクトリから
文字列変換、校正、翻訳のうちインストールしたい機能のものを選びます。すべて選べば、全拡張機能がインストールされます。

```text
extension-conversion/
extension-proofreading/
extension-translation/
```

サーバーの再生成・再配置や設定変更後は `zed: restart language server` を実行します。
以後は `.txt` ファイルを開くと各機能を利用できます。プロジェクトをどこに置いたかに依存せず起動できます。
設定については[機能ごとの設定（項目・ルール単位の有効・無効）](#機能ごとの設定（項目・ルール単位の有効・無効）)をご覧ください。

## 環境

Node.js 22 以降、Rust と `wasm32-wasip2` ターゲットを使用します。

```sh
npm ci --ignore-scripts
npm run patch:deps
npm test
cargo build --manifest-path extension-conversion/Cargo.toml --target wasm32-wasip2 --release --locked
```

## Zed での動作確認

1. 取得したこのプロジェクトを任意の場所に置き、`npm ci --ignore-scripts` と `npm run patch:deps` を実行します。
2. `npm run setup:example` を実行します。現在の Node.js 実行パスとプロジェクトの
   配置先から、Git 対象外の `examples/.zed/settings.json` を生成します。
   既存ファイルは上書きしません。配置先を移動した場合は、既存設定を退避して再生成してください。
3. 「導入（開発版）」の手順で3つのサーバー配布物を生成・配置し、Zed の
   `zed: install dev extension` で `extension-conversion/`、`extension-proofreading/`、
   `extension-translation/` をそれぞれ選びます。ビルドには Rust と `wasm32-wasip2`
   ターゲットが必要です。
4. `examples` フォルダー自体を Zed のプロジェクトとして開きます。
5. `width.txt` の `ABC123` を選択し、コードアクション（通常 `Ctrl+.`）から「英数字を全角に変換」を実行します。
6. 前後の日本語・絵文字が保持されること、Undo で戻せること、未保存で加筆した文字も変換できることを確認してください。
7. 同ファイル末尾の英字・数字・記号・カナ・ひらがな／カタカナのサンプルも選択して、
   対応する コードアプション（「英字を全角に変換」「記号を半角に変換」など）が個別に変換できることを確認します。
   記号変換では空白が変換されないこと、カナ変換では濁点・半濁点が結合されることも確認してください。

別のフォルダーで利用する場合は生成された設定をそのフォルダーの `.zed/settings.json` に記述します。
全フォルダーで利用する場合も同様で、 Zed のユーザー設定自体に設定を記述すれば使えるようになります。

### 機能ごとの設定（項目・ルール単位の有効・無効）

3 拡張とも、`.zed/settings.json` の `lsp.<拡張 ID>.initialization_options` に設定を書きます。
設定変更後は言語サーバーの再起動（コマンドパレット: `zed: restart language server`）が必要です。
なお、機能を無効化すると、コードアクションのメニューから表示を隠すだけでなく、実行じたいがされなくなります。
設定の記述は下記のようになります。

**変換拡張**（`lsp.writing-tools-conversion.initialization_options`）:

```json
{
  "conversion": {
    "enabled": true,
    "items": {
      "width.full.alphanumeric": true,  //英数字を全角に変換
      "width.half.alphanumeric": true,  //英数字を半角に変換
      "width.full.alpha": true,  //英字を全角に変換
      "width.half.alpha": true,  //英字を半角に変換
      "width.full.digit": true,  //数字を全に変換
      "width.half.digit": true,  //数字を半角に変換
      "width.full.symbol": true,  //記号を全角に変換
      "width.half.symbol": true,  //記号を半角に変換
      "width.full.kana": false,  //カタカナを全角に変換
      "width.half.kana": false,  //カタカナを半角に変換
      "kana.hiragana": false,  //カタカナをひらがなに変換
      "kana.katakana": false  //ひらがなをカタカナに変換
    }
  }
}
```

`"enabled": false` で拡張全体を無効化します。
各設定項目で`true``false`を記述することで有効と無効を切り替えられます。

**校正拡張**（`lsp.writing-tools-proofreading.initialization_options`）:

```json
{
  "diagnostics": {
    "enabled": true,
    "rules": {
      "max-ten": false,  //多すぎる読点を検出
      "no-doubled-conjunctive-particle-ga": true,  //逆接の接続助詞の連続を検出
      "no-doubled-conjunction": true,  //接続詞の連続を検出
      "no-double-negative-ja": false,  //二重否定を検出
      "no-doubled-joshi": true,  //同じ助詞の連続を検出
      "sentence-length": false,  //1行が長すぎる場合に警告
      "no-dropping-the-ra": false,  //ら抜き表現の検出
      "no-mix-dearu-desumasu": false,  //である・ですます体の混合を検出
      "no-nfd": false,  //濁点の分離を検出
      "no-invalid-control-character": true,  //不正な制御文字の検出
      "no-zero-width-spaces": true,  //ゼロ幅スペース検出
      "no-kangxi-radicals": true  //康煕部首の検出
    }
  }
}
```

校正のうち文単位で解析する 5 ルール（max-ten・no-doubled-conjunctive-particle-ga・
no-doubled-conjunction・no-doubled-joshi・sentence-length）は動作が重いタメ、文書サイズが 30000 字を超えた場合に自動スキップされます。

**翻訳拡張**（`lsp.writing-tools-translation.initialization_options`）:

```json
{
  "translation": {
    "enabled": true,
    "items": {
      "deepl.ja": true,  //日本語に翻訳
      "deepl.en": false  //英語に翻訳
    }
  }
}
```

`"enabled": false`がデフォルトで、翻訳機能全体が無効化されています。trueにすることで有効になります。
「DeepLで日本語に翻訳」「DeepLで英語に翻訳」（`EN-US`）の 2 つの
コードアクション を提供します。翻訳元言語は DeepL 側の自動判定に任せます（`source_lang` を送りません）。

**APIキーの設定**: 環境変数 `DEEPL_AUTH_KEY` にご自身の DeepL APIキーを設定してから
言語サーバー（Zed）を起動してください。利用料金・上限、無料／有料プランごとのデータ取り扱いの違いは
[DeepL API の利用規約](https://www.deepl.com/en/pro-license)・
[プライバシーポリシー](https://www.deepl.com/en/privacy)を確認してください。本プロジェクトの
GPLv3 ライセンス（下記「ライセンス」節）とは別に、DeepL サービス自体の利用条件が適用されます。

APIキーを記述する変数名の見本として`.env.example` を用意しています。
公式ドキュメント（[Zed の環境変数について](https://zed.dev/docs/environment)）によれば、
Zed はホームディレクトリで**ログインシェルを起動してその環境変数を読み取れ**ます。
したがってたとえばzsh の場合、ログインシェルが読むのは `.zshenv`・`.zprofile` です。
環境変数はこれらのファイル、または OS 側の `~/.config/environment.d/`に設定してください。

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
