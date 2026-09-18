# GPLv3 公開前の依存ライセンス確認

確認日: 2026-09-19。ユーザー方針: 本プロジェクトを GPLv3 とする。
これは配布準備の技術的な調査記録であり、個別の法的適合性を保証するものではない。

## 結論

本プロジェクトに GPLv3 を採用する方針は維持できる。主要なコード依存に
GPLv3 採用を阻む条件は見つからなかった。ただし、現行配布物をそのまま
「全依存確認済み・公開可」とは扱わない。CC-BY-3.0 データの扱い、辞書の
独自条件、表示・ソース提供の整備をリリース前の未完了項目として残す。

## 対象と確認方法

- 現在の生成済み配布物 `dist/text-tools-server/0.1.0` は npm 依存 6 件。
- `dist/text-tools-proofreading-server/0.1.0` は npm 依存 241 件。
  入れ子の `node_modules` も含む配置単位の件数。辞書は別途確認。
- 両 Cargo プロジェクトを `cargo metadata --locked --offline` で確認。
  各 87 件の外部 crate。同じ依存集合。ホスト側のビルド依存・対象外プラットフォームも
  含む保守的な一覧であり、全件が Wasm にリンクされるという意味ではない。
- npm の実ファイルから package.json の表記と LICENSE/NOTICE/README を確認。
  Cargo は全 crate の宣言を列挙し、Apache・Unicode・複合条件の実ファイルを確認した。
  各ソースファイルの著作権調査や、完成 Wasm の全構成要素の出所監査までは実施していない。
- [一覧](dependency-licenses.tsv) に配置先・版・宣言・トップレベルの表示ファイルを記録。
  空欄は即「無許諾」を意味せず、README や上流リポジトリでの確認が必要という意味。
- Rust 1.97.1 の標準ライブラリには toolchain の `share/doc/rust/COPYRIGHT-library.html`
  がある。最終 Wasm 配布では crate 一覧だけでなく、この表示と WASI runtime の扱いも含める。
  Zed・Node の本体は今回のサーバー配布物に同梱していない。

## ライセンス別の判断

| 対象 | 確認結果・扱い |
| --- | --- |
| 変換用 npm 6 件 | 全件 MIT。元の表示を保持して GPLv3 の本体と組み合わせる方針で問題は見つからない |
| textlint・校正ルール等 | 大半は MIT。BSD-2/3-Clause、ISC、WTFPL、CC0 も含む。ライセンス本文・必要な帰属を保持する |
| kuromoji、zed_extension_api 等 | Apache-2.0。GPLv3 と互換。パッチによる変更表示、ライセンス、該当 NOTICE の保持が必要 |
| argparse | `Python-2.0` 表記。実ファイルは PSF と歴史的ライセンスの連結。名前だけを Python 2.0 初期版の非互換条件と取り違えない。実際の LICENSE を丸ごと保持する |
| glob、lru-cache 等 5 件 | BlueOak-1.0.0。ライセンス提供元の FAQ は GPLv3 との組み合わせを認める見解。本文または指定リンクを保持する |
| ICU4X、unicode-ident 等 | Unicode-3.0。GNU は GPL と互換と説明。`unicode-ident` は `(MIT OR Apache-2.0) AND Unicode-3.0` なので Unicode 条件を省略しない |
| その他の Rust 依存 | MIT/Apache の選択式、Zlib 等。`OR` は選択可能、`AND` は両条件を満たす。Wasm 系の LLVM 例外付き選択式も、MIT 等の別選択肢と区別する |
| format 0.2.2 | lock の license 欄が無くても無許諾ではない。package.json の旧 `licenses` 配列とソース・Readme で MIT 表記を確認 |

互換性の根拠:

- [Apache と GPLv3](https://www.apache.org/licenses/GPL-compatibility)
- [GNU のライセンス一覧（Unicode v3、Python、MIT、BSD 等）](https://www.gnu.org/licenses/license-list.en.html)
- [Blue Oak の GPL 互換性 FAQ](https://blueoakcouncil.org/license-faq)
- [GPLv3 本文](https://www.gnu.org/licenses/gpl-3.0.html)

## 別途扱う辞書・データ

### mecab-ipadic-2.7.0-20070801

`node_modules/kuromoji/NOTICE.md` に原文・出所がある。kuromoji の Apache-2.0 とは別の
NAIST/ICOT 条件（[NAIST-2003 本文](https://spdx.org/licenses/NAIST-2003.html)）である。
改変版を含む再配布の許可があり、著作権表示・条件・免責全文の保持を要求する。
現行配布物には NOTICE.md 自体が残っているため、「辞書の表示が完全に欠落」とは判定しない。
ただし集約 THIRD_PARTY_NOTICES では辞書を識別していない。

辞書を本体と一括して GPLv3 へ変更したと表示しない。独立データとして元条件を保ち、
配布物の一覧に明示する。過去に ICOT の文言を巡る議論もあるため、一般的な BSD と
同一視したり、コードへの組み込みまで含めた無条件の GPL 互換と断定しない。
原文の保持だけで本件のあらゆる配布形態の法的評価が済むという結論ではない。

### spdx-exceptions 2.5.0

CC-BY-3.0 の識別子リスト。README に Linux Foundation と Contributors の帰属表示がある。
導入経路は `textlint → read-package-up → read-pkg → normalize-package-data →
validate-npm-package-license → spdx-expression-parse → spdx-exceptions`。

CC-BY-3.0 を GPLv3 互換として自動承認しない。未改変データを別条件で収録することと、
GPL の派生物として組み込むことは区別が必要。提供者による「機械的な一覧で創作性がない」
という説明だけを根拠に、著作権やライセンス条件を無視する判断もしない。
[CC-BY-3.0 原文](https://creativecommons.org/licenses/by/3.0/legalcode.en)は、
コレクション内でも元のライセンス・帰属表示等を保持することを要求する。

推奨する解決方向は、CLI/設定探索を必要としない本サーバーでは `textlint` の高水準 API
から `@textlint/kernel` の直接使用へ移行できるか検証し、この依存経路を配布物から外すこと。
未実装・未検証であり、ファイルを削除するだけでは不可。維持する場合は独立データとしての
収録・利用の評価を別途完了させる。現段階では公開判定上の未解決項目。

## 現在の表示生成処理で修正が必要な点

1. 校正配布物の実依存は 241 件だが、集約処理は直下の 233 件しか列挙しない。
   入れ子 8 件は元ファイルには存在する。再帰列挙し、版違いも表示に含める。
2. LICENSE の候補名が限定されている。`kuromoji/LICENSE-2.0.txt` や小文字の
   `license`、複数の LICENSE、NOTICE、README 内の許諾を適切に扱う。
3. `author` やリポジトリ所有者から著作権者を推測して生成しない。
   例: imurmurhash は README に Gary Court と Jens Taylor の連名・年がある。
   テンプレートで年を消したり著作権者を一人にすると原表示の正確な転記にならない。
4. `AND` を `OR` と同じように処理し最初の識別子だけ採用する方式を廃止する。
   現行 npm には AND 式はないが、Rust には実在する。共通化時にも注意する。
5. Rust/Wasm 向けの第三者表示は別途生成する。npm の表示だけではカバーできない。
   元 crate に表示ファイルが無い場合は、対応版の上流原文を取得・保存し、推測しない。
6. GPLv3 本文、本体のライセンス宣言、リリース版に対応するソース・ビルド手順・パッチ・
   必要な依存ソースの提供を整える。トップレベルの GitHub 自動ソース ZIP だけで
   依存まで含めた Corresponding Source が満たされるとは限らない。

本調査では上記の実装修正、ライセンスの付与、公開、依存差し替えは行っていない。
GPLv3-only / or-later の明示も、LICENSE を整える段階で確定する。
