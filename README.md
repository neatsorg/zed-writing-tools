# Zed Writing Tools

Zed 用の日本語文章作成支援拡張です。機能ごとに個別にインストールできます。

- **Conversion**：英数字・記号・カタカナ・ひらがなの、全角半角変換または相互変換
- **Proofreading**：textlint の日本語ルールによる校正診断
- **Translation**：選択範囲を DeepL で日本語または英語の相互翻訳

現在の対象は Zed の `Plain Text` と `.txt` ファイルです。

## インストール

Zed の拡張画面（`Ctrl+Shift+X`、macOS は `Cmd+Shift+X`）で、必要な拡張を検索してインストールしてください。インストール後の初回起動時に、必要な言語サーバーが GitHub Releases から自動取得されます。

サーバー取得を許可しない設定やネットワーク環境では、拡張を利用できないことがあります。
開発版を使うと強制導入できる場合があります。必要であれば[開発手順](docs/development.md)を参照してください。

## 既知の制限

### 未保存のファイルへの対応

一度でも名前をつけて保存したファイルであれば、未保存の編集内容も拡張機能の実行対象にできます。
ただし、一度も保存していない `Untitled` バッファは、Zed の言語サーバー登録仕様により対象にならない場合があります。
この制限を解消したい場合、Zed の仕様が変わらない限り、現状では拙作の[zed-scratch-buffers](https://github.com/neatsorg/zed-scratch-buffers)などのハック的な解決を自己責任でご併用いただくしかありません。詳しくはそちらをご覧ください。

### 校正の制約

校正機能のうち、文単位で解析する 5 ルール（max-ten・no-doubled-conjunctive-particle-ga・no-doubled-conjunction・no-doubled-joshi・sentence-length）は動作が重いため、文書サイズが 30000 字を超える場合には実行されません。一般的な日本語文書の作成には支障がないかと思います。
また校正は `preset-japanese` の同梱ルールを使い、プロジェクトの `.textlintrc` は読みません。

## 使い方

- **文字列変換**：`.txt` ファイルを開き、対象とする文字列を選択します。Code Actions（通常 `Ctrl+.`）から任意の変換または翻訳機能を選択してください。なおメニューに表示する項目は設定にて指定可能です（後述）。
- **校正**：拡張機能が有効であれば、文書を開くと自動で診断して文書内に下線表示し、内容をステータスバーまたはメニュー表示します。なお使用する校正機能は設定にて指定可能です（後述）。
- **翻訳**：文字列変換と同じく、`.txt` ファイルを開いて、対象とする文字列を選択し、Code Actions（通常 `Ctrl+.`）から翻訳機能を選択してください。翻訳元言語は DeepL 側の自動判定に任せます（`source_lang` を送りません）。またメニューに表示する項目は設定にて指定可能です（後述）。

翻訳機能を使う場合には DeepL API キーが必要です。Zed を使うPC環境に設定してください。

```sh
export DEEPL_AUTH_KEY="your-api-key"
```

セキュリティ上の観点から、上記のキーを外部参照できる設定ファイルやリポジトリ上に平文で保存しないことを強くお勧めします。

翻訳を実行した場合の料金、利用上限、データの扱いは [DeepL の利用規約](https://www.deepl.com/en/pro-license) と[プライバシーポリシー](https://www.deepl.com/en/privacy)を確認してください。

## 機能ごとの設定（項目やルール単位の有効・無効）

3 拡張とも、`settings.json` の `lsp.<拡張 ID>.initialization_options` に設定を書きます。
各設定項目で `true` あるいは `false` を記述することで有効と無効を切り替えられます。
`"enabled": false` にすると拡張全体が無効化されます。
設定変更後は、ステータスバーの言語サーバーメニューから「すべてのサーバーを再起動」を実行してください。
拡張機能の各機能を無効化すると、コードアクションのメニューから表示を隠すだけでなく、実行そのものがされなくなります。

設定の記述は下記のようになります（有効／無効は一例です）。

**変換**（`lsp.writing-tools-conversion.initialization_options`）:

```json
{
  "conversion": {
    "enabled": true,
    "items": {
      "width.full.alphanumeric": true,
      "width.half.alphanumeric": true,
      "width.full.alpha": true,
      "width.half.alpha": true,
      "width.full.digit": true,
      "width.half.digit": true,
      "width.full.symbol": true,
      "width.half.symbol": true,
      "width.full.kana": false,
      "width.half.kana": false,
      "kana.hiragana": false,
      "kana.katakana": false
    }
  }
}
```

**校正**（`lsp.writing-tools-proofreading.initialization_options`）:

```json
{
  "diagnostics": {
    "enabled": true,
    "rules": {
      "max-ten": false,
      "no-doubled-conjunctive-particle-ga": true,
      "no-doubled-conjunction": true,
      "no-double-negative-ja": false,
      "no-doubled-joshi": true,
      "sentence-length": false,
      "no-dropping-the-ra": false,
      "no-mix-dearu-desumasu": false,
      "no-nfd": false,
      "no-invalid-control-character": true,
      "no-zero-width-spaces": true,
      "no-kangxi-radicals": true
    }
  }
}
```

**翻訳**（`lsp.writing-tools-translation.initialization_options`）:

```json
{
  "translation": {
    "enabled": true,
    "items": {
      "deepl.ja": true,
      "deepl.en": false
    }
  }
}
```

項目単位・ルール単位の設定や設計の詳細は [設計方針](docs/architecture.md)を参照してください。

## ライセンス

本プロジェクトのオリジナルコードは GPL-3.0-or-later です。全文は [LICENSE](LICENSE)を参照してください。npm・Cargo の依存はそれぞれのライセンス条件に従い、配布物には `THIRD_PARTY_NOTICES` と必要な NOTICE を同梱します。

配布版に対応するソース、ロックファイル、パッチ、生成手順はこのリポジトリで確認できます。
配布とライセンス監査の詳細は [リリース手順](docs/release-licensing.md)を参照してください。
