# textlint 接続のための調査（2026-09-19）

開発順序 6（校正エンジンの接続）に向けて、元の日本語校正拡張
（[niikei/japanese-proofreading-info](https://github.com/niikei/japanese-proofreading-info)）の
ルール構成・ライセンスと、textlint 自体の位置情報・処理時間の特性を調査した記録。
結論は [設計方針](architecture.md) の開発順序 6 に反映済み。ここでは詳細データを残す。

## 元拡張の依存とライセンス

`package.json` の `dependencies`:

| パッケージ | バージョン | ライセンス | 備考 |
| --- | --- | --- | --- |
| textlint | ^12.5.1 | MIT | 最新は 15.8.0（2026-09-19 時点）。`@textlint/textlint-plugin-text` を標準搭載し `.txt` に対応 |
| textlint-plugin-html/latex2e/review | 各種 | 未確認 | `.txt` のみが対象の今回は不要 |
| textlint-rule-preset-icsmedia | github 直接参照 | MIT | npm 未公開（`github:ics-creative/textlint-rule-preset-icsmedia`）。prh 辞書 7 種 + preset-japanese/jtf-style の推奨設定 |
| textlint-rule-preset-japanese | ^7.0.0 | MIT | 最新は 10.0.4。「誤検知が少ないルールに限定、スタイル系ルールは含めない」という方針を明言 |
| textlint-rule-preset-jtf-style | ^2.3.13 | MIT | 最新は 3.0.3 |
| textlint-rule-prh | ^5.3.0 | MIT | 最新は 6.1.0。辞書ベース（prh 本体も MIT） |

`textlint-rule-preset-japanese` が依存する各ルールパッケージ（すべて MIT、npm 公開）:

| パッケージ | バージョン確認時 | 更新日 |
| --- | --- | --- |
| textlint-rule-max-ten | 5.0.0 | 2023-11-26 |
| textlint-rule-no-doubled-conjunctive-particle-ga | 3.0.0 | 2023-11-26 |
| textlint-rule-no-doubled-conjunction | 3.0.1 | 2026-05-30 |
| textlint-rule-no-double-negative-ja | 2.0.1 | 2021-12-12 |
| textlint-rule-no-doubled-joshi | 5.1.1 | 2025-09-05 |
| textlint-rule-sentence-length | 5.2.1 | 2026-01-03 |
| textlint-rule-no-dropping-the-ra | 3.0.0 | 2021-04-24 |
| textlint-rule-no-mix-dearu-desumasu | 6.0.4 | 2025-01-16 |
| textlint-rule-no-nfd | 2.0.2 | 2023-06-06 |
| @textlint-rule/textlint-rule-no-invalid-control-character | 3.0.0 | 2024-08-03 |
| textlint-rule-no-zero-width-spaces | 1.0.1 | 2021-05-01 |
| textlint-rule-no-kangxi-radicals | 0.2.2 | 2023-07-30 |

ICS MEDIA プリセット（`textlint-rule-preset-icsmedia`）の実体は `.textlintrc.json` ＋
prh 辞書 7 ファイル（`prh.yml`, `prh_cho_on.yml`, `prh_corporation.yml`, `prh_duplicate.yml`,
`prh_idiom.yml`, `prh_open_close.yml`, `prh_redundancy.yml`, `prh_web_technology.yml`）。
npm 未公開のため依存管理が複雑になる。初回スコープでは見送り。

## 位置情報の検証

`linter.lintText()` が返す `message.index`／`message.range`／`message.loc.column` の単位を、
絵文字・結合文字・改行を含む文字列で検証した。

初回実装（2026-09-19 実装時点）では、`no-dropping-the-ra` の 1 ルールだけを見て
「`index` は Unicode コードポイント単位」と判断し、全ルールの結果に対して
コードポイント→UTF-16 変換を一律適用した。これは誤りで、レビュー（後述）で
複数の再現例により誤りが判明した。**正しい結論は次の「位置情報の検証（訂正）」節を参照。**

## 位置情報の検証（訂正、レビュー対応 2026-09-19）

レビューで次の再現例が報告された。

- `😀あ​い。` で `no-zero-width-spaces` の指摘が本来のゼロ幅スペースではなく「い」を指す。
- `😀。\n食べれる。` で `no-dropping-the-ra` の指摘が「れ」ではなく「る」を指す。

いずれも、初回実装のコードポイント→UTF-16 変換を全ルールに一律適用したことが原因だった。
`@textlint/text-to-ast`（`.txt` 用パーサー）のソースを確認すると、AST ノードの `range` は
`lineText.length`（JS 文字列の `.length`、つまり **UTF-16 コードユニット単位**）で計算されている。
つまり **textlint 本体の基本位置単位は UTF-16** であり、初回実装の前提（コードポイント単位）が
そもそも誤りだった。

一方、`textlint-rule-no-zero-width-spaces` のような正規表現ベースのルールは
`text.matchAll(/.../)` の `match.index`（JS 文字列上のインデックス、UTF-16 単位）を相対位置として
`report()` に渡す。これは textlint 本体の基準と一致するため、変換なしで正しく動く。

対して `textlint-rule-no-dropping-the-ra` は `kuromojin.tokenize()`（kuromoji.js の Promise
ラッパー）が返すトークンの `word_position` を使う。実測すると、絵文字を含む文字列で
`word_position` は **1-indexed の Unicode コードポイント位置**だった
（`前置き😀食べれる。` を kuromoji でトークン化すると `😀` の `word_position` は 4、
`れ` は 7。コードポイント単位で 3、6 に対応し、UTF-16 単位（`😀` が 2 ユニット）とは一致しない）。
`@textlint/kernel` の `resolveLocation`（`source-location.js`）は
`absoluteRange = [nodeRange[0] + paddingIR.range[0], ...]` という加算で絶対位置を作るため、
UTF-16 単位のノード開始位置に、コードポイント単位の相対位置がそのまま加算され、
絵文字を含む文書ではズレる。

同様の実測（絵文字ありなしでの相対シフト量を比較）を `textlint-rule-preset-japanese` の
全 12 ルールに対して行った結果:

| 分類 | ルール | 位置単位 | 実装 |
| --- | --- | --- | --- |
| ズレる（形態素解析・言語解析系） | max-ten | コードポイント | kuromoji |
| | no-doubled-conjunctive-particle-ga | コードポイント | kuromoji |
| | no-doubled-conjunction | コードポイント | kuromoji（文単位で正しいノード開始位置に相対 0 を加算するため、対象トークンが文頭にあると偶然ズレが見えないことがある） |
| | no-doubled-joshi | コードポイント | kuromoji |
| | no-double-negative-ja | コードポイント | kuromoji |
| | no-dropping-the-ra | コードポイント | kuromoji |
| | no-mix-dearu-desumasu | コードポイント | `analyze-desumasu-dearu`（内部で形態素解析） |
| ズレない（正規表現・単純な走査） | sentence-length | UTF-16 | 文字数カウント |
| | no-nfd | UTF-16 | 正規表現 |
| | no-invalid-control-character | UTF-16 | 正規表現 |
| | no-zero-width-spaces | UTF-16 | 正規表現 |
| | no-kangxi-radicals | UTF-16 | 正規表現 |

ズレるルールを外部から正確に補正するには、textlint 内部の文分割ロジック（`sentence-splitter`
相当）を再現してノード境界を特定する必要があり、現実的ではない
（`no-doubled-conjunction` の例のように、ノードの開始位置自体は正しいことがあるため、
「行単位で一律に変換する」ような近似では、既に正しい値をさらにズラして悪化させることがある）。

対応（実装済み）: `message.range` は変換せず、そのまま UTF-16 オフセットとして使う
（textlint 本体の基準に合わせる）。ズレる 7 ルール（上表）は、対象の文書に
サロゲートペア（絵文字等）が含まれる場合にスキップする。結合文字（`é` の合成前表現など）は
元から 1 コードポイント＝1 UTF-16 コードユニットなので影響しない。

## 処理時間の検証

`textlint-rule-preset-japanese` の 12 ルールを対象に、繰り返しのない日本語文（「これは N 番目の
文章で、少しだけ内容が異なります。」を連結）で計測した。

### 単体コスト（ウォームアップ後、2 回目の実行を採用）

21489 字での単体実行時間:

| ルール | 時間 |
| --- | --- |
| max-ten | 191ms |
| no-doubled-conjunctive-particle-ga | 227ms |
| no-doubled-conjunction | 184ms |
| no-doubled-joshi | 186ms |
| sentence-length | 172ms |
| no-double-negative-ja | 11ms |
| no-dropping-the-ra | 5ms |
| no-mix-dearu-desumasu | 8ms |
| no-nfd | 3ms |
| no-invalid-control-character | 3ms |
| no-zero-width-spaces | 3ms |
| no-kangxi-radicals | 2ms |

上位 5 ルール（max-ten・no-doubled-conjunctive-particle-ga・no-doubled-conjunction・
no-doubled-joshi・sentence-length）はいずれも文単位で解析するルールで、他より 1〜2 桁重い。
30000〜35000 字での単体コストも同程度（341〜544ms、いずれも 1 秒未満）。

### 全 12 ルール合計でのスケーリング

| 文字数 | 全 12 ルール | 重い 5 ルール除外（7 ルールのみ） |
| --- | --- | --- |
| 10000 | 330ms | - |
| 20000 | 888ms | - |
| 30000 | 1966ms | - |
| 35000 | 2517ms | - |
| 8000 | - | 60ms |
| 32000 | - | 114ms |
| 100000 | - | 298ms |

重い 5 ルールは単体では 1 秒未満だが、5 つ同時に有効にすると合計が加算され、
30000 字で約 2 秒になる。7 ルールのみなら 100000 字でも 300ms 程度で、文書サイズに対して
ほぼ線形。

### イベントループのブロッキング

`lintText()` の実行中、`setInterval` で仕込んだ 50ms ごとの tick が一切発火しないことを確認した
（32000 字・5 ルール構成で 2393ms の実行中、tick 0 回）。`lintText` は同期的な CPU 処理を含み、
`AbortSignal` などのキャンセル手段は API に無い。実行中は LSP サーバー全体（変換機能も含む）が
応答しなくなる。

## 決定した初回スコープ（2026-09-19、ユーザーと合意）

- 依存: `textlint` ＋ `textlint-rule-preset-japanese`（この 2 つのみ。両方 MIT）。
- ルール: `textlint-rule-preset-japanese` の全 12 ルールを有効にする。
- 文書サイズ対策: 文書の文字数（JS 文字列の `length`、UTF-16 コードユニット数）が
  30000 字を超える場合、重い 5 ルール（max-ten・no-doubled-conjunctive-particle-ga・
  no-doubled-conjunction・no-doubled-joshi・sentence-length）をスキップする。
  軽量な 7 ルールは文書サイズに関わらず常に実行する。
- 見送り: `textlint-rule-preset-jtf-style`、`textlint-rule-prh`、ICS MEDIA 辞書。
  将来必要になった段階で追加を検討する。
- 根拠: 実務上の校正対象は数千字程度が多く、30000 字超はまず発生しない想定
  （元拡張のサンプル文書 [EXAMPLES.md](https://github.com/ics-creative/project-japanese-proofreading/blob/master/EXAMPLES.md)
  は約 5000 字）。30000 字ちょうどの文書を編集した場合の最悪ケース（重い 5 ルール合計で
  約 2 秒のブロッキング）は許容する。
- 位置情報: 上記「位置情報の検証（訂正）」のとおり、絵文字を含む文書では形態素解析系の
  7 ルールをスキップする。文書サイズ対策（重い 5 ルール）とは別の軸で、両方を同時に判定する。

## レビュー対応（2026-09-19）

最初の実装（コミット `1188ae8`）に対するレビューで、次の 3 件が報告され、いずれも対応した。

1. **位置ズレ**（上記「位置情報の検証（訂正）」参照）。コードポイント→UTF-16 変換の一律適用を
   取りやめ、`message.range` を UTF-16 オフセットのまま使う。形態素解析系 7 ルールは
   サロゲートペアを含む文書でスキップする。
2. **校正拡張が既定で診断しない**。`src/lsp/create-server.js` の診断有効化条件を
   `initializationOptions?.diagnostics?.enabled === true` から `!== false` に変更した。
   `inspections`（校正拡張）がある場合は既定で有効、明示的な `false` でのみ無効化する
   （`inspections` が空の変換拡張・本格校正接続前は影響しない）。
3. **プロジェクトの textlint 設定を意図せず読み込む**。`loadTextlintrc({})` は設定ファイルを
   探索する（`textlintrc` が見つかればフィルター・プラグインが混入する）。`textlint` パッケージが
   公開する API には「設定探索なしでビルトインプラグインだけロードする」関数
   （`loadBuiltinPlugins`）が存在するが、これは非公開の内部 API（`textlint/lib/src/loader/`
   配下）で、パッケージの公開エントリーポイントからは export されていない。代わりに
   `@textlint/kernel` の `TextlintKernelDescriptor` を直接構築し、
   `@textlint/textlint-plugin-text` を明示的にプラグインとして渡すことで、設定探索を
   完全に回避した（`@textlint/kernel`・`@textlint/textlint-plugin-text` を依存に追加）。

再現手順・検証は `test/proofread.test.js` に自動テストとして追加した
（絵文字を挟んだ位置の正確性、形態素解析系ルールのスキップ、`.textlintrc` の非依存、
診断の既定有効化・明示的な無効化）。
