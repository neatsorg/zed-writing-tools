# 設計方針と開発順序

## 目的

Zed での日本語執筆を支援する。文字変換・校正・翻訳のエンジンと LSP アダプターは
共通コードとして育てる。将来、他の拡張・エディタからも利用できるよう、
エンジンは LSP と Zed に依存させない。

当初は「一つの Zed 拡張＋一つの共通サーバー」で合意していたが、変換機能と校正機能を
独立してリリースしたい方針を受け、2026-09-19 に Zed 拡張を機能ごとに分割する設計へ変更した
（経緯は [HANDOFF.md](../HANDOFF.md) 参照）。共通サーバーの実装は共有するが、
拡張ごとに異なる機能サブセットを有効にした別プロセスとして起動する。
「機能ごとに別のサーバー実装を持たない」という元の合意は維持する。

## 構成

- 変換拡張（ID: `text-tools`。`extension/`）: 変換エンジンのみを有効にしてサーバーを起動する。
- 校正拡張（ID: `text-tools-proofreading`。`extension-proofreading/`）:
  校正エンジンのみを有効にしてサーバーを起動する。
- 共通コード（`src/`）: エンジン・LSP アダプター・機能登録。当面は同じリポジトリで両方の
  拡張と同居する。

各拡張は別の言語サーバー ID を持ち、有効にする機能（`transformations`／`inspections`）を
起動用のエントリーポイントで固定する。`src/lsp/create-server.js` は
`{ transformations, inspections }` を引数に取る構成にしてあり、`src/lsp/server.js`
（変換拡張、`inspections: []`）と `src/lsp/proofreading-server.js`
（校正拡張、`transformations: []`）がそれぞれ `src/features/conversion.js`／
`src/features/proofreading.js` から必要な機能だけを渡す。変換拡張は校正エンジン
（textlint）を import しないため、その依存を読み込まない。両方の拡張を同時に導入しても、
機能が重複したり 2 つのサーバーが同じ範囲を検査したりしない。

サーバー配布物も分ける。拡張ごとに配布物ディレクトリ名（`text-tools-server`／
`text-tools-proofreading-server`）を分け、校正拡張の配布物にのみ textlint 系の依存を
含める（`extension/src/lib.rs`・`extension-proofreading/src/lib.rs` 参照）。
配布物の生成・配置スクリプトの対応は、校正エンジン本体の実装（開発順序 6）で行う。

## 責務の境界

| 部分 | 責務 | 現在の配置 |
| --- | --- | --- |
| Zed 拡張（変換・校正） | サーバーの起動と設定。将来は取得・更新も担当 | `extension/`（変換）、`extension-proofreading/`（校正） |
| サーバー本体 | LSP ハンドラーの組み立て。`{ transformations, inspections }` を受け取る | `src/lsp/create-server.js` |
| 拡張ごとのエントリーポイント | 対象拡張向けの機能サブセットで `create-server.js` を起動する | `src/lsp/server.js`（変換用）、`src/lsp/proofreading-server.js`（校正用） |
| LSP アダプター | 文書同期、位置変換、版管理、Code Action、Diagnostics | `src/lsp/` |
| 機能登録 | エンジンの ID、表示名、実行関数を組み合わせる | `src/features/conversion.js`、`src/features/proofreading.js` |
| 各エンジン | 文字列に対する変換・検査・将来の翻訳 | `src/engines/` |

エンジンに LSP の URI・Range・Diagnostic や Zed 固有 API を渡さない。
位置と重要度を LSP に変換する責務はアダプターに置く。
変換の現行契約は文字列入力と文字列出力で、非同期処理と AbortSignal を受け取れる。
校正エンジンは `{ start, end, message }`（UTF-16 オフセット、終了位置を含まない）の配列を返し、
`diagnostics.js` が LSP の Diagnostics に変換する（`test/fixtures/dummy-inspection.js` の
ダミーエンジンと同じ契約）。各機能の有効・無効は独立して設定できるようにする。

文書の版を確認し、古い結果を適用しない。変換失敗時は原文を保持する。
外部 API は候補列挙時に呼ばない。汎用の動的プラグインホストや任意コマンド実行は初期範囲に含めない。

## 開発順序

0. 英数字の半角・全角変換が Zed 上で動く状態を初期コミットに保存する。
1. Zed のユーザー設定を整え、任意のフォルダーの `.txt` で使えるようにする。
2. 同じサーバーに指定語を情報レベルで指摘する検証用診断を追加する。
   未保存編集への追従、検査の集約、古い結果の破棄と指摘の消去を確認する。
3. 変換を英字・数字・記号の個別指定、カナ、ひらがな、対応文字の設定へ拡充する。
   VS Code 参照元の変換結果と、Zed の選択・操作上の対応範囲は別々に検証する。
4. 固定パスへの依存を解消し、サーバーの取得・起動・更新と配布を整える。
   Node 実行パスは Zed の `node_binary_path()`、サーバー本体は拡張の作業ディレクトリへ
   配置したバージョン付き配布物から解決する（`binary` の明示設定があれば優先）。
   配布物の生成・配置は現在ローカルの npm スクリプトで行う。公開先が決まったら、
   同じ生成手順を CI に、配置を拡張からの GitHub Releases 取得・展開に置き換える。
5. Zed 拡張を変換用・校正用に分割する（実施済み、2026-09-19）。`create-server.js` へ
   機能サブセットを注入する形を使い、`extension-proofreading/`（ID: `text-tools-proofreading`）
   を新設した。`src/features.js` は `src/features/conversion.js`・`src/features/proofreading.js`
   に分割し、`src/lsp/server.js`（変換用）はそれぞれ対応するモジュールから必要な機能だけを
   渡す。変換拡張は校正エンジンを import しないため、textlint 系の依存を読み込まない。
   既存の変換拡張の動作（Code Action・自動解決）は自動テストで壊れていないことを確認済み
   （実機での確認は未実施）。サーバー配布物のディレクトリ名も分けたが、配布物生成スクリプトの
   校正用対応は次のステップで行う。
6. 校正エンジンを textlint に接続する（実施済み、2026-09-19）。初回スコープを次の調査結果に
   基づいて決定した（`docs/textlint-research.md` に詳細を記録）。
   - **ルールと配布**: 元の日本語校正拡張（niikei/japanese-proofreading-info）が使う
     `textlint`・`textlint-rule-preset-japanese`・`textlint-rule-preset-jtf-style`・
     `textlint-rule-prh`・ICS MEDIA 辞書（`textlint-rule-preset-icsmedia`、GitHub 直接参照で
     npm 未公開）はすべて MIT。初回は `textlint` ＋ `textlint-rule-preset-japanese`
     （npm 公開・MIT・「誤検知が少ないルールに限定し、スタイル系ルールは含めない」という
     方針を明言）のみを依存に追加する。`preset-jtf-style`・`prh`・ICS MEDIA 辞書は
     見送り、将来必要になった段階で追加を検討する。
   - **位置の対応**: textlint 本体（`@textlint/text-to-ast`）の AST ノード位置は
     **UTF-16 コードユニット単位**（textlint の基本単位）。正規表現ベースのルールはこれと
     一致するため変換不要だが、`preset-japanese` の一部ルール（kuromoji などの形態素解析・
     言語解析を使う max-ten・no-doubled-conjunctive-particle-ga・no-doubled-conjunction・
     no-doubled-joshi・no-double-negative-ja・no-dropping-the-ra・no-mix-dearu-desumasu の
     7 ルール）は相対位置を Unicode コードポイント単位で計算し、それが UTF-16 単位の
     ノード開始位置にそのまま加算されるため、絵文字（サロゲートペア）を含む文書で
     絶対位置がズレる（外部からの正確な補正は、textlint 内部の文分割ロジックの再現が必要で
     現実的ではないと判断）。校正エンジンは `message.range` を変換せず UTF-16 オフセットの
     まま使い、上記 7 ルールはサロゲートペアを含む文書ではスキップする
     （`diagnostics.js` に渡す `{ start, end }` は UTF-16 オフセットで統一する契約のまま。
     2026-09-19 レビューで初回実装の誤り（コードポイント単位という誤った前提での一律変換）を
     修正。詳細は `docs/textlint-research.md`）。
   - **処理時間**: `textlint-rule-preset-japanese` の 12 ルールのうち、文単位で解析する
     5 ルール（`max-ten`・`no-doubled-conjunctive-particle-ga`・`no-doubled-conjunction`・
     `no-doubled-joshi`・`sentence-length`）は文書サイズに対して超線形に遅くなる
     （単体では 30000 字で 300〜500ms 程度だが、5 ルールを同時に有効にすると合計で
     30000 字あたり約 2 秒）。残り 7 ルールは 100000 字でも 300ms 程度で軽量。
     また `lintText` の実行中は Node.js のイベントループが完全にブロックされ、
     API にキャンセル手段は無い（`AbortSignal` を渡せない）。
     対策として、文書の文字数（JS 文字列の `length`、UTF-16 コードユニット数）が
     30000 字を超える場合は重い 5 ルールをスキップし、軽量な 7 ルールのみ実行する
     （2026-09-19 決定。実務上の校正対象は数千字程度が多く、30000 字超はまず発生しない
     想定。参考: 元拡張のサンプル文書 [EXAMPLES.md](https://github.com/ics-creative/project-japanese-proofreading/blob/master/EXAMPLES.md)
     は約 5000 字）。
   - 初回は `.txt` 対象・情報レベルの指摘に絞る。プロジェクトごとの任意ルール読み込みや
     自動修正は、この段階のスコープに含めない（将来の追加機能として扱う）。
   実装: `src/engines/proofread.js`（サイズ・絵文字の有無に応じたルール切り替え。設定ファイルは
   探索しない — `@textlint/kernel` の `TextlintKernelDescriptor` を直接構築し、
   `@textlint/textlint-plugin-text` を明示的にプラグインとして渡す。`textlint` パッケージが
   公開する `loadTextlintrc` は設定探索を行うため使わない）、
   `scripts/build-server-dist.js`／`deploy-server-dev.js` の対象別対応
   （`scripts/targets.js` に拡張ごとの依存・配布物名・エントリーポイントを集約）。
   LICENSE ファイルを持たない依存は `package.json` の SPDX ライセンス識別子から
   `scripts/license-texts/` の標準テキストで補う（著作権者は author／repository から推定）。
   校正拡張（`inspections` がある拡張）は診断を既定で有効にし、明示的な
   `initialization_options.diagnostics.enabled: false` でのみ無効化する
   （`src/lsp/create-server.js`）。
7. DeepL を追加する（校正拡張とは別に接続するか、校正拡張に含めるかは未定）。

字数の常時表示は後段とし、このための Zed 本体変更は初期範囲に含めない。

## Git と公開

当面はプロジェクト全体を一つのリポジトリで管理する。変換拡張・校正拡張・共通コードを
同じリポジトリに置き、それぞれ独立してリリースできるようにする（2026-09-19、拡張の分割方針）。
ソース、文書、テスト、npm と Cargo のロックファイルを記録し、依存パッケージ本体、
ビルド成果物、環境用メタデータは除外する。
複数のリポジトリへ分割する必要が生じた段階で、改めて検討する。

公開先・正式名称・本プロジェクトのライセンスは未決定。
ローカル Git の初期化とコミットは GitHub 公開とは別に実施する。
マシン固有のパスは `npm run setup:example` で検出し、Git 対象外の
`examples/.zed/settings.json` に生成する。接続情報・設置先のメモは `*.local.md` に置く。
`.env` と `.env.*` も Git 対象外（`.env.example` のみ共有可）。現時点で .env の読み込みは不要。
