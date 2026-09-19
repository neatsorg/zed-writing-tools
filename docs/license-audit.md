# GPLv3 公開前の依存ライセンス確認

確認日: 2026-09-19。ユーザー方針: 本プロジェクトを GPLv3 とする。
これは配布準備の技術的な調査記録であり、個別の法的適合性を保証するものではない。

追記（2026-09-19）: 下記「未解決事項」のうち、CC-BY-3.0 依存経路の除去・
辞書表示の識別明確化・表示生成スクリプトの修正（npm 側・Rust 側とも）は対応済み。
末尾の「現在の表示生成処理で修正が必要な点」の項目 6（GPLv3 本文・LICENSE 宣言・
Corresponding Source の整備）も対応済み。詳細は各節に追記した。

## 結論

本プロジェクトに GPLv3（GPL-3.0-or-later）を採用する方針は維持できる。主要なコード依存に
GPLv3 採用を阻む条件は見つからなかった。CC-BY-3.0 データの依存経路除去、
辞書表示の識別明確化、表示生成スクリプトの修正、GPLv3 本文・LICENSE 宣言・
Corresponding Source の整備はすべて完了した。残るのは GitHub リポジトリ公開時に
README 等へ実際の URL を反映することのみ。

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

対応済み（2026-09-19）: 集約 THIRD_PARTY_NOTICES の kuromoji セクションで、
NOTICE ファイルの見出しを「NOTICE（同梱データ等への追加条件の可能性、本体ライセンスとは
別に保持）」に変更し、Apache-2.0 本体表示と辞書条件を並記のまま区別できるようにした
（`scripts/build-server-dist.js` の `findNoticeFile` 呼び出し部分）。個別パッケージ名を
ハードコードせず、NOTICE ファイルを持つ全パッケージに同じ扱いを適用する汎用処理。

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

対応済み（2026-09-19）: `src/engines/proofread.js` を `@textlint/kernel` の
`TextlintKernel`／`TextlintKernelDescriptor` を直接使う実装に変更し、`textlint` パッケージ
本体への依存を `package.json` から削除した。校正配布物を再ビルドして確認した結果、
`spdx-exceptions`・`read-package-up`・`normalize-package-data` 等の依存経路一式が
インストール対象から消え、npm 依存件数は 241 件から 111 件（`node_modules` 内、直下＋入れ子）
に減少した。CC-BY-3.0 データはこの配布物にもはや含まれない。

## 現在の表示生成処理で修正が必要な点

1. 対応済み。`listInstalledPackages`（`scripts/build-server-dist.js`）を、直下だけでなく
   入れ子 `node_modules` も再帰的に列挙する実装に変更した。同一 `name@version` は
   最初に見つかったものを使う（内容は同一のはず）。校正配布物は依存整理後で 109 件。
2. 対応済み。`findLicenseFile` で LICENSE/LICENCE の大小文字・拡張子違いを広く受け付け、
   `findLicenseInReadme` で README 内の MIT 全文埋め込みも検出する。見つからない場合は
   `scripts/known-licenses/`（個別確認済み全文、25 件）で解決し、それでも無い場合は
   ビルドを失敗させる（取りこぼしの隠蔽を防ぐ）。
3. 対応済み。`extractCopyrightHolder` 的な推測処理は削除し、`hasCopyrightPlaceholder` で
   プレースホルダーの有無だけを判定する方式にした。著作権者欄が要るライセンスで
   LICENSE/README/known-licenses のいずれでも解決できない場合はビルドを失敗させる。
4. 対応済み。npm 側（`resolveLicenseBySpdxField`）は `AND` を検出したら例外を投げ、
   個別確認を強制する方式にした（現行 npm 依存には実在しない）。Rust 側は
   `scripts/spdx-expression.js` の `parseSpdxExpression` で AND を「複数セクションを
   すべて収録する」正しい形で処理する（`unicode-ident` の
   `(MIT OR Apache-2.0) AND Unicode-3.0` で確認済み）。
5. 対応済み。`scripts/build-rust-notices.js` を新規実装。`cargo metadata --locked --offline`
   で両 Cargo 拡張（`extension/`, `extension-proofreading/`、依存集合は完全に同一）の
   全 87 crate を解決し、`extension/THIRD_PARTY_NOTICES`・
   `extension-proofreading/THIRD_PARTY_NOTICES` を生成した（`npm run build:rust-notices`）。
   crate 内に LICENSE 系ファイルが無い 11 crate（wasm-tools 系・wit-bindgen 系・
   auditable-serde）は `scripts/known-licenses-rust/` に上流リポジトリの原文を個別保存して
   解決し、それ以外は汎用 SPDX テンプレート（著作権者欄の無いもののみ、
   `scripts/license-texts/` に Unicode-3.0・Zlib・Unlicense・0BSD を追加）で解決した。
   いずれの手段でも解決できない場合はエラーにする（npm 側と同じ方針、推測での補完はしない）。
6. 対応済み（2026-09-19）。ユーザーの確認により、著作権者を Sayawaka、バージョンを
   GPL-3.0-or-later に確定した。リポジトリ直下に GPLv3 公式全文（gnu.org/licenses/gpl-3.0.txt
   をそのまま取得、674 行、差分なしで確認済み）を `LICENSE` として追加。`package.json`
   （`license`・`author`）、両 `Cargo.toml`（`license`）、両 `extension.toml`（`authors`）に
   宣言を追加し、配布物側の生成 `package.json`（`scripts/build-server-dist.js`）にも
   `license` を伝播させた。README に「ライセンス」節を新設し、本体コードの GPLv3 表示、
   同梱依存は元のライセンスのまま保持する旨、Corresponding Source（本リポジトリの全ソース・
   ロックファイル・パッチ・ビルド手順で再現可能）を明記した。GitHub リポジトリ URL は
   未確定のため、README・LICENSE とも URL を含まない相対的な書き方にとどめている
   （リポジトリ名は `zed-japanese-writing-tools` を予定と共有を受けたが、公開時に別途反映）。

本調査の項目 6（ライセンス付与・公開・Corresponding Source の整備）は完了した。
残る対応は、GitHub リポジトリを実際に作成した時点で README 等に URL を反映することのみ。
