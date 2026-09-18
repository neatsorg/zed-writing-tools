# Zed Text Tools — 開発ハンドオフ

作成日: 2026-09-18
プロジェクト名・ディレクトリ名は仮称: `zed-text-tools`

## 最新更新: 形態素解析のサロゲートペア対応

形態素解析系 7 ルールの文書全体スキップを撤回。kuromoji 0.1.2 に固定パッチを追加し、
トークン位置を UTF-16 に補正、連続する未知語のサロゲートペア長も修正した。
詳細は `patches/README.md` と `docs/textlint-research.md` 末尾。
`npm ci --ignore-scripts` 後に直接校正サーバーを起動する場合は `npm run patch:deps` が必要。
`npm test` / `npm start` は自動適用、配布物のビルドも明示的に適用する。
過去の「絵文字があれば7ルールをスキップ」という記録より本項を優先する。
検証: 全24テスト成功。両配布物を再生成し、ソースツリー外にコピーした状態で校正と変換を確認。
変換配布物に textlint・kuromoji が含まれないことも確認。
GUI 再確認・既存動作確認先への配置は未実施。

## 開発開始後の更新（2026-09-18）

2026-09-19: 同じサーバーに任意有効化の検証用診断を追加。
エンジンは `src/engines/check-word.js`、検査の集約・古い結果の破棄と
LSP への変換は `src/lsp/diagnostics.js`。従来の「診断は未実装」という記録を更新する。
自動テストで変換との併用、未保存変更、診断の消去、処理中の変更・クローズ、失敗後の復帰を検証。

2026-09-19: ユーザーが動作確認先の Zed GUI で診断表示を確認済み。「要確認」の指摘表示、
変換との両立、削除時の指摘消去のいずれも動作。一点判明した既知の制約として、
Plain Text で新規作成した無題バッファ（未保存・保存先なし）は無反応。これは元のハンドオフに
ある「無題バッファは対応を約束せず、挙動を確認して範囲を決める」の対象。今回は対応を保留し、
将来の課題として記録する。

2026-09-19: 変換機能を拡充（開発順序 3）。`src/engines/width.js` に英字・数字・記号それぞれの
半角/全角変換（`toFullwidthAlpha`/`toHalfwidthAlpha` など）を追加。記号変換は英数字・空白を
対象外にする（無差別な ASCII 全体変換だと文章のスペースが崩れるため）。半角カナ／全角カナ
（濁点・半濁点の結合を含む）と、ひらがな／カタカナ変換（新規 `src/engines/kana.js`）は、
自作の誤りやすさを避けるため [jaconv](https://github.com/kazuhikoarase/jaconv)
（MIT、依存なし、2025-06-27 公開）を依存に追加して実装。`src/features.js` の
`transformations` に 10 個の Code Action を追加（既存 2 個と合わせて計 12 個）。
自動テストをローカル・動作確認先の両方で実行し成功（7 テスト）。動作確認先へは `src/`・`test`・
`package.json`・`package-lock.json` を再同期し、`npm install --ignore-scripts` を実施済み。
Zed 拡張（Wasm）側の変更はなし。**GUI での新機能の動作確認はユーザー確認待ち。**

2026-09-19: 開発順序 4（固定パスへの依存解消）に着手。方針をユーザーと確認：
サーバー配布物（依存ライブラリ込み）は拡張そのものへの同梱ではなく、拡張とは別に
作成する。開発段階ではローカルで生成・配置、公開後は同じ生成手順を CI で実行し、
拡張が GitHub Releases から取得・展開する（npm 経由のインストール API も選択肢として
検討したが、GitHub Releases を採用）。配置先は開発段階・公開後とも拡張の作業ディレクトリ
（Zed の Wasm 実行環境で `env::current_dir()` が指す場所。実例は
[zed-extensions/vue](https://github.com/zed-extensions/vue) の `src/vue.rs` で確認）。
起動は Node 自動解決（`zed_extension_api` の `node_binary_path()`）＋サーバーの絶対パス。
`lsp.text-tools.binary` の明示設定があれば従来通り優先する。

実装したもの:
- `extension/src/lib.rs`: 明示設定が無い場合、Node は `node_binary_path()`、サーバーは
  拡張の作業ディレクトリ配下 `text-tools-server/CURRENT_VERSION` が示すバージョンの
  `src/lsp/server.js` を絶対パスで解決する。
- `scripts/build-server-dist.js`: `dist/text-tools-server/<version>/`
  （package.json・ロックファイル・src・本番依存のみの node_modules・THIRD_PARTY_NOTICES）
  をローカルに生成。THIRD_PARTY_NOTICES は各依存の LICENSE ファイルを収集し、
  LICENSE ファイルを持たない既知の依存（vscode-languageserver 系、Microsoft MIT）は
  ライセンス全文をスクリプト内に保持して補う。未知の依存で LICENSE が見つからない場合は
  ビルドを失敗させる。
- `scripts/deploy-server-dev.js`: 生成物を Zed 拡張の作業ディレクトリへ配置し
  `CURRENT_VERSION` を書き込む（Linux・macOS 対応、Windows は未対応）。
- `dist/` は Git 対象外（生成スクリプト・ロックファイルは追跡するので再生成できる）。

検証（ローカルと動作確認先の両方）:
- 配布物単体（`node_modules` を含むそのディレクトリのみ）で LSP サーバーとして
  initialize・codeAction・resolve が正常応答することを確認。
- 動作確認先でプロジェクトの `src/` を一時的にリネームしても配布物単体が動作することを確認
  （元のソース配置先に依存しないことの裏付け）。
- 動作確認先の Zed 拡張（Wasm）を再ビルド。Zed 設定から `lsp.text-tools.binary` の明示設定を
  削除（バックアップ済み、`~/.config/zed/settings.json.text-tools-binary-explicit-*.bak`）し、
  自動解決を検証可能な状態にした。
- **GUI での自動解決の動作確認、および Zed が選ぶ Node のバージョンが `engines.node >= 22`
  を満たすことの確認はユーザー確認待ち。** `~/.local/share/zed/node/` にはまだ実体（キャッシュ
  のみ）が見当たらず、実際に選ばれる Node は未確認。

未実装（公開先が決まった後の作業）: GitHub Releases への配布物アップロード（CI）、
拡張からのダウンロード・展開処理（`download_file`／`make_file_executable` を使う想定）。

2026-09-19: 開発順序 4 の受け入れ条件を動作確認先の Zed GUI で確認済み。
`zed: install dev extension` は Zed 自身が Rust をビルドして `extension.wasm` を書き出す
仕様（`crates/extension/src/extension_builder.rs`）のため、ターミナルでの `cargo build` は
構文確認にしかならず、コード変更の反映には毎回 Zed 上での再実行が必要（今回そのため一度
古いエラーが再現した。以後の担当者への注意点として記録）。

Zed.log で確認できた実績:
- 明示 `binary` 設定を外した状態で、text-tools プロジェクトと無関係な別フォルダを
  working directory として
  `args: [".../extensions/work/text-tools/text-tools-server/0.1.0/src/lsp/server.js", "--stdio"]`
  で正常に起動。元のソース配置先に依存しないことを実機で確認。
- `binary path: "/usr/bin/node"`（`node_binary_path()` がシステム Node を自動解決）。
  `node --version` は `v26.8.1` で `package.json` の `engines.node >= 22` を満たす。
- ユーザーが GUI 上で変換・診断とも成功したことを確認済み。

開発順序 4 は完成範囲を満たした。残るのは未実装（公開先が決まった後の GitHub Releases 化）のみ。

2026-09-19: 変換と固定パス解消が実機確認済みになったのを受け、検証用のダミー診断
（「要確認」を検出するだけの `demo.word`）を製品コードから外した。ユーザーとの整理方針：

- 残すもの: `src/lsp/diagnostics.js`（検査の集約・古い結果の破棄・診断の消去・失敗時の
  復帰を扱う LSP アダプター）と、その単体テスト（`test/diagnostics.test.js`）。
  本格校正エンジン（textlint 接続）でもそのまま再利用する。
- 外すもの: `src/engines/check-word.js`、`src/features.js` の `demo.word` 登録、
  `server.js` 側のダミー起動・検証用パラメータ（`diagnostics.word`）の受け渡し、
  README の有効化手順、`examples/diagnostics.txt`。
- テスト側に移すもの: 指定語を検出するダミー検査エンジン
  （`test/fixtures/dummy-inspection.js`）。製品の起動経路には置かない。
  診断と変換の両立を検証する E2E には価値があるため、製品にテスト用の分岐を
  追加せずに残す方針とし、`src/lsp/server.js` を薄いエントリーポイントとして分離し、
  本体（`src/lsp/create-server.js`）に `{ transformations, inspections }` を注入する形に
  リファクタリングした。テストは `test/fixtures/test-server.js`
  （`create-server.js` にダミー診断を注入するテスト専用エントリーポイント）を起動する。
- 表現の整理: `diagnostics.js` 内の `source: 'text-tools-demo'` を `'text-tools'` に、
  エラーメッセージ「検証用の診断に失敗しました」を「診断に失敗しました」に変更
  （アダプター自体は削除・テスト専用化していない）。

`inspections` が空の間は、`initialization_options.diagnostics.enabled` を true にしても
サーバーは何もしない（エラーにはならない）。次の担当者は、本格校正エンジンを
`src/features.js` の `inspections` に登録するだけで診断が有効になる。

`npm test` は `test/*.test.js` のみを対象にするよう `package.json` を変更した
（Node.js の `--test` はデフォルトで `test/` 配下の全 `.js` を検索するため、
`test/fixtures/` のテスト専用スクリプトを誤って実行してしまう問題への対処）。

2026-09-19: レビューで `scripts/deploy-server-dev.js` の不具合を指摘された。
コピー元（`dist/text-tools-server/<version>/`）の存在を確認する前に配置先の同バージョンを
削除していたため、配布物が未生成・破損の状態で実行すると、稼働中のサーバーまで削除され、
`CURRENT_VERSION` は古いバージョンを指したまま復旧できなくなる不具合があった。
一時ディレクトリ（`.staging-<version>`）へコピーし、サーバー本体（`src/lsp/server.js`）の
存在を確認できてから既存版を `rm` → `rename` で置き換える方式に修正。コピー元の存在確認も
最初に行い、無ければ既存の配置に触れずに失敗する。`XDG_DATA_HOME` を一時ディレクトリに向けて
正常系・異常系（配布物を退避した状態での再実行）を検証済み：異常系では既存の配置がそのまま
残ることを確認した。

2026-09-19: 開発順序 5・6（本格校正の接続）に進むにあたり、設計変更に合意した。
元の合意「Zed 拡張ひとつ＋独自 LSP サーバーひとつ」を、変換拡張・校正拡張を独立して
リリースしたい方針を受けて「機能ごとに Zed 拡張を分ける（変換拡張／校正拡張）、
共通サーバー実装は共有するが起動プロセスは拡張ごとに分かれる」に変更する。
「機能ごとに別のサーバー実装を持たない」という元の合意の核は維持する。
方針の詳細（構成、暫定の言語サーバー ID、`create-server.js` への機能サブセット注入、
textlint 接続で確認すべき点）は `docs/architecture.md` に記録した。今回は方針の文書化のみで、
実装（拡張の分割、textlint 接続）はまだ着手していない。

2026-09-19: ユーザーの提案順（ルール調査 → 拡張分割 → textlint 接続）に沿って、まず
textlint 接続のための調査を実施した。詳細データは `docs/textlint-research.md`、結論は
`docs/architecture.md` の開発順序 6 に反映済み。要点：

- 元拡張の依存（textlint、preset-japanese、preset-jtf-style、prh、ICS MEDIA 辞書）は
  すべて MIT。初回は npm 公開・MIT・「誤検知が少ないルールに限定」を明言する
  `textlint` ＋ `textlint-rule-preset-japanese` のみを採用し、jtf-style・prh・
  ICS MEDIA 辞書（npm 未公開）は見送る。
- textlint の指摘位置は UTF-16 ではなく **Unicode コードポイント単位**だった
  （絵文字で実測確認）。校正エンジン側でコードポイント→UTF-16 のオフセット変換が必須。
- `preset-japanese` の 12 ルール中 5 つ（文単位で解析するもの）は文書サイズに対して
  超線形に遅くなり、5 つ合計で 30000 字あたり約 2 秒。`lintText` 実行中は Node.js の
  イベントループが完全にブロックされ、キャンセル手段も無い。
- 対策として、文字数（UTF-16 コードユニット数）が 30000 字を超えたら重い 5 ルールを
  スキップする方針をユーザーと合意（実務上の校正対象は数千字程度が多いため、
  最悪ケース＝2 秒のブロッキングは許容する）。

次は拡張分割（変換用・校正用に ID を分け、`extension.toml` と起動エントリーポイントを
用意する）と、校正エンジンの実装（`textlint` 接続、位置変換、サイズ上限）に進む。

2026-09-19: 拡張分割を実装した。
- `extension-proofreading/`（ID: `text-tools-proofreading`、Cargo crate 名
  `zed-text-tools-proofreading`）を新設。`extension/src/lib.rs` と同じ自動解決ロジック
  （`node_binary_path()` ＋作業ディレクトリ内のバージョン付き配布物）だが、配布物ディレクトリ名を
  `text-tools-proofreading-server` に分け、`src/lsp/proofreading-server.js` を指す。
- `src/features.js` を `src/features/conversion.js`（`transformations`）と
  `src/features/proofreading.js`（`inspections`。今はまだ空）に分割。
  `src/lsp/server.js`（変換拡張のエントリーポイント）は `conversion.js` からのみ
  `transformations` を渡し（`inspections: []`）、校正エンジン（textlint）を import しない。
  新設した `src/lsp/proofreading-server.js` は `proofreading.js` から `inspections` を渡し
  （`transformations: []`）、変換の Code Action を提供しない。
- `test/fixtures/test-server.js` の import 元を `features/conversion.js` に更新。
- `.gitignore` に `extension-proofreading/target/`・`extension-proofreading/extension.wasm` を追加。

検証: `npm test` 8 テストすべて成功（既存の変換 E2E テストも壊れていない）。
`cargo build --manifest-path extension-proofreading/Cargo.toml --target wasm32-wasip2 --release`
成功。`proofreading-server.js` を単体でスモークテストし、initialize に正常応答、Code Action が
0 件（`transformations` を渡していないため）であることを確認。**実機での確認、
両拡張の同時導入確認はまだ未実施。**

サーバー配布物の生成・配置スクリプト（`scripts/build-server-dist.js`／`deploy-server-dev.js`）は
まだ変換用のみに対応しており、校正用への対応は次の textlint 接続の実装で行う。

2026-09-19: 拡張分割を動作確認先の Zed GUI で実機確認した。`extension-proofreading/` の
`zed: install dev extension` を実行し、Rust のコンパイルが成功（Zed.log で確認）、
`.txt` を開くと想定通り「サーバー配布物が見つかりません（.../text-tools-proofreading/
text-tools-proofreading-server/CURRENT_VERSION）。校正用の配布物を生成・配置してください。」
で失敗した（配布物をまだ作っていないため、この失敗は正しい）。既存の変換拡張
（`text-tools`）は校正拡張のインストール後も引き続き正常に起動していることを Zed.log で確認。
拡張 ID の分離・作業ディレクトリの分離・Rust ビルドが実機で機能することを確認できたので、
次に校正エンジン本体（textlint 接続）の実装に進んだ。

2026-09-19: 校正エンジン（`src/engines/proofread.js`）を実装した。
- textlint の `loadTextlintrc({})`（設定ファイル無し、ビルトインの `.txt` 対応プラグインのみ）に
  `textlint-rule-preset-japanese` のルールを `descriptor.shallowMerge()` でプログラム的に追加する
  方式を採用（`.textlintrc.json` ファイルを配布物に含める必要がない）。
- 文書サイズ（`text.length`、UTF-16 コードユニット数）が 30000 字を超える場合、重い 5 ルールを
  含まない descriptor に切り替える。2 種類の linter を初回検査時に一度だけ構築してキャッシュする。
- コードポイント位置 → UTF-16 オフセットの変換表を検査ごとに構築して `message.range` を変換する。
- `src/features/proofreading.js` の `inspections` に登録。
- `src/lsp/server.js`（変換拡張）は `src/features/conversion.js` からのみ import するため、
  textlint 系の依存を読み込まない。

自動テスト（`test/proofread.test.js`）: 位置変換（絵文字を挟んだ位置での正確性）、
サイズ上限での重いルールのスキップ、`proofreading-server.js` を spawn した E2E
（診断が届くこと、変換の Code Action を提供しないこと）を追加。ローカル・動作確認先とも
`node --test test/*.test.js` 11 テストすべて成功。

`scripts/build-server-dist.js`／`scripts/deploy-server-dev.js` を対象別（`conversion`／
`proofreading`）に対応させた。共通の定義は新設した `scripts/targets.js` に集約
（拡張 ID・配布物ディレクトリ名・エントリーポイント・依存パッケージ一覧）。
`npm ci` は package.json の dependencies に無い依存はインストールしないため、対象ごとに
依存を絞った package.json を書き、ルートの package-lock.json はそのまま使う方式を確認して採用。

校正用配布物は 242 パッケージ・約 101MB（変換用は 1.9MB）。最大の要因は
`kuromoji`（形態素解析辞書、40MB）で、`no-mix-dearu-desumasu` ルールが使う。
サイズの最適化は今回のスコープ外。

ライセンス処理: 85 個の依存が LICENSE ファイルを同梱していなかった（remark/mdast/micromark 系、
kuromoji、sindresorhus 氏や wooorm 氏の多数のユーティリティなど）。1 件ずつ `KNOWN_LICENSE_TEXTS`
に登録する方式は非現実的と判断し、`package.json` の SPDX ライセンス識別子（`license` フィールド、
古い `licenses` 配列形式も対応）から `scripts/license-texts/`（MIT・Apache-2.0・BSD-2/3-Clause・
CC0-1.0・CC-BY-3.0・ISC・WTFPL・BlueOak-1.0.0・Python-2.0、SPDX 公式テキストをそのまま保存）の
標準テキストを補う方式に変更した。著作権者は `author`／`contributors`／`repository` から推定する。
未知の SPDX 識別子（テンプレート未用意）は今まで通りビルドを失敗させる。

配布物単体でのスモークテスト（校正用）: `proofreading-server.js` を直接起動し、initialize・
Code Action（0 件）・診断配信（ら抜き言葉検出、`source: "text-tools"`）を確認。

2026-09-19: 動作確認先の Zed GUI で確認済み（成功）。校正拡張の配布物を配置し、Zed 設定に
`text-tools-proofreading` を追加（`initialization_options.diagnostics.enabled: true`、
`languages."Plain Text".language_servers` に追加）した上で言語サーバーを再起動し、
`examples/proofread.txt` の指摘（ら抜き言葉・二重否定）が表示されることを確認。
配布物の依存構成を対象別に絞り込む方式へ変更した後の変換拡張（`width.txt`）の動作も
問題なく確認済み。開発順序 5・6（拡張分割・textlint 接続）は完成範囲を満たした。

2026-09-19: 上記コミット（`1188ae8`）へのレビューで 3 件の問題が報告され、いずれも対応した。
詳細は `docs/textlint-research.md` の「レビュー対応」節、要点は次のとおり。

1. **位置ズレ（P1）**: 初回実装は `no-dropping-the-ra` の 1 ルールだけを見て「textlint の
   `index` は Unicode コードポイント単位」と誤って一般化し、全ルールの結果にコードポイント→
   UTF-16 変換を一律適用していた。実際には textlint 本体（AST ノード位置）の基本単位は UTF-16
   で、`preset-japanese` のうち kuromoji 等の形態素解析・言語解析を使う 7 ルール
   （max-ten・no-doubled-conjunctive-particle-ga・no-doubled-conjunction・no-doubled-joshi・
   no-double-negative-ja・no-dropping-the-ra・no-mix-dearu-desumasu）だけが、相対位置を
   コードポイント単位で計算していた。修正: 変換を撤回し `message.range` を UTF-16 のまま使う。
   上記 7 ルールは、対象文書にサロゲートペア（絵文字）が含まれる場合にスキップする
   （外部からの正確な補正は textlint 内部の文分割ロジックの再現が必要で現実的ではないと判断）。
2. **校正拡張が既定で診断しない（P2）**: `create-server.js` の有効化条件を
   `enabled === true` から `enabled !== false` に変更。`inspections` がある拡張（校正拡張）は
   既定で有効、明示的な `false` でのみ無効化する。
3. **プロジェクトの textlint 設定を意図せず読み込む（P2）**: `loadTextlintrc({})` は設定ファイル
   探索を行うため、LSP サーバーの作業ディレクトリ（開いているプロジェクトのルートになりうる）
   にある `.textlintrc` のフィルター・プラグインが混入していた。`loadBuiltinPlugins`
   （設定探索なしでビルトインプラグインだけロードする関数）は `textlint` パッケージの
   公開エントリーポイントから export されていなかったため、`@textlint/kernel` の
   `TextlintKernelDescriptor` を直接構築し `@textlint/textlint-plugin-text` を明示的に渡す
   実装に変更した（両パッケージを依存に追加）。

自動テスト（`test/proofread.test.js`）に、絵文字を挟んだ位置の正確性、形態素解析系ルールの
スキップ、`.textlintrc` の非依存、診断の既定有効化・明示的な無効化を追加。ローカルで
`node --test test/*.test.js` 15 テストすべて成功。

動作確認先の Zed GUI で確認済み（成功）。校正拡張の配布物を再ビルド・再配置し、Zed 設定から
`text-tools-proofreading.initialization_options.diagnostics.enabled: true` の明示を削除
（バックアップ済み）した状態で言語サーバーを再起動し、`examples/proofread.txt` の指摘が
設定なしでも表示されることを確認した。開発順序 6 のレビュー対応は完了。

以下は元のハンドオフより優先する、開発開始後の合意と状況です。

- 動作確認先は Linux の多言語対応版 Zed 1.20.2。接続情報と設置先は Git 対象外の `DEVELOPMENT.local.md` に記録。
- 最初の対象は `.txt`。ユーザー指示に従い、半角全角変換から実装・操作確認する。
- サーバーは後続機能にも使える共通基盤とし、LSP と変換エンジンを容易に分離できる構造にする。
- 元校正拡張の textlint 利用、ルール構成、本体 MIT ライセンスを確認。
  Node.js + vscode-languageserver を選定。個々の校正ルールのライセンス確認は接続時に行う。
- 英数字の半角／全角の純粋関数、機能登録、LSP アダプター、Zed 起動拡張を分けた初期実装を追加。
- この時点では診断は未実装。英数字変換の実機確認後、同じサーバーに単純診断を追加する。
- ローカルと動作確認先の双方で stdio LSP を含む自動テストが成功。
  拡張の `wasm32-wasip2` リリースビルドも成功。
- 動作確認先に初期実装を配置済み。Wasm ターゲットも追加済み。
  試用用設定は `npm run setup:example` で各環境に生成し、Git 対象外とする。
  その後ユーザーから、Zed 上で初期変換が正常動作したとの報告あり。
  Undo など個々の操作の確認結果は未記録。
- 初期コミットに向けた設計方針は `docs/architecture.md` に記録。
  任意フォルダーでの利用 → 単純診断 → 変換拡充 → 配布整備 → 本格校正 → DeepL の順で進める。
  当面は一つの Git リポジトリに、責務を分けた拡張・サーバー・エンジンを収める。
- 手順と最新の制約は `README.md` を参照。以下にある「まだ実装していない」等の記述は引き継ぎ時点の履歴。

## 目的と合意事項

Zed で、日本語執筆に使う VS Code 拡張相当の機能を実現する。ユーザーと合意した方針は「Zed 拡張ひとつ＋独自 LSP サーバーひとつ」。最初から hx-lsp と別の独自サーバーを並行して育てる構成にはしない。

独自サーバーとは、LSP の通信・プロトコルをゼロから実装する意味ではない。既存の LSP ライブラリを使い、文書管理と各機能の接続部分を実装する。校正エンジンや変換ライブラリも再利用を優先する。

今回の依頼範囲は新しいディレクトリの作成と方針の記録まで。実装、依存関係の導入、Git 初期化、公開はまだ行っていない。

## 欲しい機能

### 1. 半角・全角などの文字変換

参考: https://marketplace.visualstudio.com/items?itemName=masakit.zenkaku-hankaku

- 英字・数字・記号を対象別に半角／全角へ変換。
- 半角カナ／全角カナ、ひらがな／カタカナの変換。
- 元拡張は複数選択に対応し、無選択時は全文を対象にする。ただし Zed でその操作をすべて再現できるとは未確認。
- Code Action を入口にして、編集を Zed に返す。
- 無差別な NFKC 正規化で代用しない。対象外文字、濁点・半濁点、句読点や記号の対応を明示的に扱う。

### 2. DeepL 翻訳

参考: https://marketplace.visualstudio.com/items?itemName=soerenuhrbach.vscode-deepl

- 選択部分を指定言語に翻訳して置換する。
- 将来候補: 原文を残して追記、翻訳先の選択・記憶。
- Code Action の候補表示だけで API を呼ばない。ユーザーが選択した段階で実行する。
- API キーの保管・受け渡しは未設計。コードやログへ埋め込まない。
- 半角全角と校正の基盤を確認した後に追加する。

### 3. 日本語校正のリアルタイム指摘

参考: https://marketplace.visualstudio.com/items?itemName=niikei.japanese-proofreading-info

- 元拡張は「テキスト校正くん」のフォークで、エラーを情報レベルへ変更したもの。
- 文書同期で未保存の内容を受け取り、校正結果の範囲・メッセージ・重要度を LSP Diagnostics で返す。
- 下線、スクロールバーの印、ホバーは Zed の既存表示を使う。本体の表示機能追加は基本不要。
- 元拡張のルールと実装は未調査。ルールの再利用方法、ライセンス、診断位置、重要度の対応付けを調べる。元拡張独自の severity 数値を LSP の数値としてそのまま流用しない。

### 4. 字数カウンター（後段）

参考: https://marketplace.visualstudio.com/items?itemName=kirozen.wordcounter

- 文字数・単語数・行数・段落数・推定読書時間など。
- 全文の集計は文書同期で可能だが、標準 LSP には全選択範囲の継続的な変更通知や任意のステータスバー表示を提供する仕組みがない。
- ステータスバー表示は別途検討する。Zed 本体変更が必要になる可能性がある。初期実装の完成条件には含めない。
- 元の調査環境の Zed v1.20.2 には、選択文字数・行数・選択数をカーソル位置欄に表示する既存実装があった。
- 集計モジュールを将来共有できる設計にする程度に留め、この機能のために最初から本体変更や独自プロトコルを導入しない。

## 構成

```text
Zed 拡張
  サーバーの取得・起動・設定の受け渡し
      │ LSP
独自の共通サーバー
  文書同期・位置変換・設定・キャンセル・エラー処理
      ├─ 変換モジュール → Code Action → 編集
      │    ├─ 半角全角
      │    └─ DeepL
      └─ 校正モジュール → Diagnostics
```

- 各機能は内部モジュールとして分離し、個別に有効・無効にできるようにする。
- ユーザーの導入は一つの Zed 拡張を基本にする。サーバー配布・実行環境をどうまとめるかは実装技術選定時に決める。
- サーバーは Zed 拡張の Wasm 内に処理を埋め込まず、標準 LSP を話す独立プロセスとして実装する。現時点で対象とする拡張は一つだが、この構成であれば将来的に複数の言語 ID、あるいは他の Zed 拡張・他エディタからの再利用も原理上可能になる（hx-lsp・efm-langserver が実例として示す性質と同じ）。ただし再利用の口を初手で作り込む必要はなく、今回のスコープ・受け入れ条件にも含めない。設計判断で「特定拡張専用の内部実装」に固定してしまう選択を避ける程度の意識で進める。
- 既存の言語サーバーとの併用を想定し、それらを設定で不用意に無効化しない。
- 汎用プラグインホスト、動的モジュール機構、任意コマンド実行環境まで初手で構築する必要はない。
- 本プロジェクトは zed-i18n とは別のプロジェクト。翻訳カタログやビルド用チェックアウトを変更しない。

## 最初の実装目標

最初の成果は「同じ拡張・同じサーバーで文字変換と継続的な診断が動くこと」。変換だけを完成させてから診断方式を考える順序にはしない。

1. 現行の Zed API、利用する OS、対象ファイル種別を確認し、最小の Zed 開発用拡張とサーバーを用意する。
2. 半角英数字→全角英数字など、選択範囲を変換する Code Action を一つ実装する。
3. 指定した語を情報レベルで指摘する単純な診断を一つ実装する。これは接続検証用で、本格校正ルールではない。
4. 日本語を含む未保存の編集に対して、置換と診断の更新が両立することを Zed 上で確認する。
5. 共通部分の正確さを検証してから、文字変換の拡充、校正エンジンの接続、DeepL の順で進める。

### 最初に確認する受け入れ条件

- 保存済みファイルに対する未保存の編集がサーバーへ反映される。
- 選択範囲だけを置換し、前後のテキストを壊さない。Undo で戻せる。
- 日本語、絵文字、結合文字、改行を含む文書で診断と編集の位置がずれない。
- UTF-8 のバイト位置と、交渉した LSP の position encoding を混同しない。
- 指摘対象を書き換えたり削除したら、古い診断が消える。
- 連続入力では検査を適切にまとめ、古い文書版に対する結果を適用しない。
- 非同期の変換中に対象文書が変更された場合は、古い結果を無条件に適用しない。初期段階は適用中止でもよい。
- 検査や変換が失敗したときは原文を保持する。
- API 呼び出しなど副作用のある処理を Code Action の列挙時に実行しない。

無題バッファ、複数選択、複数バッファをまとめた画面、リモート開発は対応を約束せず、挙動を確認して範囲を決める。LSP の Code Action 要求は通常一つの範囲であり、VS Code の全選択取得 API と同等と考えない。

## 技術選定で未決定のこと

- サーバーの実装言語と LSP ライブラリ。Rust に固定する合意はない。Zed 側の薄い拡張と校正エンジン側の技術は分けて判断する。
- 既存校正ルールを再利用するための実行環境。日本語校正の元実装を調べてから、配布の簡単さと保守負担も含めて決める。
- 最初に支援する言語・ファイル種別。Markdown、Plain Text などは候補だが未確定。
- 正式なプロジェクト名、ライセンス、公開先、対応 OS、最低 Zed バージョン。
- 文書サイズ上限、検査間隔、設定ファイル形式、API キーの管理。

技術選定の前に、元校正拡張の構成と再利用性を読むこと。サーバー骨格を先に特定言語で大きく作り込み、後から校正エンジンの統合が難しいと分かる状況を避ける。

## 調査済みの先行例と扱い

### hx-lsp

https://github.com/erasin/hx-lsp

- Helix 向け。JSONC でシェルベースの Code Action を定義し、標準入力で選択内容を渡し、出力で選択部分を置換する仕組みが説明されている。
- ケース変換、スニペット、Markdown 加工などもある。
- Zed での実動作、診断基盤としての適性、API 呼び出しの実行タイミングは未検証。
- 今回は必須依存にせず、アクション設計などの参考にする。
- 2026-09-18 の Web 調査でも Zed 上での動作報告は見つからなかった。Helix 専用ツールという位置づけのまま扱う。

### IWE / zed-iwe

https://github.com/iwe-org/zed-iwe
https://iwe.md/docs/configuration/

- Zed 拡張があり、設定した外部コマンドを Code Action から使うテキスト変換を提供。
- Markdown の知識管理・文書構造が中心。入力テンプレートは文脈や対象ブロックのマーカーを扱う。
- 任意ファイルの数文字だけを変換する共通基盤にそのまま適合するとは未確認。
- 2026-09-18 の Web 調査で改めて確認: 「外部コマンドを Code Action 経由でテキスト変換に使う」構成が Zed 上で実際に動作している実例であることが裏付けられた。本プロジェクトの変換モジュール（半角全角・DeepL）が採る Code Action 方式の実現可能性を疑う根拠はない。

### その他

- https://github.com/mattn/efm-langserver — 外部 lint・整形ツールと LSP をつなぐ汎用サーバー。診断接続の参考。長期運用されている実績があり、校正モジュールの Diagnostics 接続方式として最も無理のない前例。
- https://docs.rs/crate/pickls/latest — 外部ツールと LLM を LSP に接続する先行例。
- https://github.com/nazzeDe/code-translate — Zed＋LSP の辞書型翻訳。英語識別子の中国語ホバー表示が対象で、選択文の翻訳ではない。

これらはドキュメントを確認した段階で、インストール・動作実証はしていない。過去の提案は実証済みの保証ではない。

## 主要な仕様資料

- Zed 言語拡張: https://zed.dev/docs/extensions/languages
- Zed 言語サーバー設定: https://zed.dev/docs/configuring-languages
- Zed 診断表示: https://zed.dev/docs/diagnostics
- LSP 仕様: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/

診断表示は既存の Zed UI を使えるが、独自コマンドパレット項目やステータスバー項目を自由に登録できるという意味ではない。Code Action とコマンドパレットの独自アクションは区別する。

## 次の担当者への依頼

このファイルを読み、まず元の日本語校正拡張のエンジン・ルール構成とライセンスを確認し、最小実装に適した LSP ライブラリを選ぶ。その後、一つの開発用 Zed 拡張から一つのサーバーを起動し、「変換一つ＋診断一つ」の検証へ進む。字数の常時表示や Zed 本体の改造を初期スコープへ追加しない。
