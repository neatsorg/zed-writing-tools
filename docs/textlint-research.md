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

```js
const text = '前置き😀食べれる。'; // 'き' の直後に絵文字(サロゲートペア)
// no-dropping-the-ra が「れ」を検出
// -> index: 6, range: [6, 7]
// JS の UTF-16 位置では text[7] が「れ」（サロゲートペアを2ユニットと数えるため）
// Unicode コードポイント位置では 6 番目が「れ」（絵文字を1文字と数えるため）
```

`index: 6` は UTF-16 位置ではなく **Unicode コードポイント位置** と一致する。
結合文字（`é` のような合成前の文字）は元から 1 コードポイント＝1 UTF-16 コードユニットなので
影響しない。改行（`\r\n`）は 2 コードポイントとして数えられる（`\r` と `\n` それぞれ）。

結論: 校正エンジンは、テキスト全体を 1 回スキャンして「コードポイント位置 → UTF-16 位置」の
対応表を作り、`message.index`／`range` をその表で変換してから `diagnostics.js` に渡す
（`{ start, end }` は既存の契約どおり UTF-16 オフセット、終了位置を含まない）。

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
