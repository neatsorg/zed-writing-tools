# リリース時のライセンス確認

確認日: 2026-09-21。対象は `zed-writing-tools` のサーバー3種とWasm拡張3種。
2026-09-25に、kuromoji/mecab-ipadic表記の補足とRust標準ライブラリ通知の追加を実施(追記は各項目内に記載)。

サーバー配布物は `npm run build:server-dist -- conversion|proofreading|translation` で生成する。
各配布物には `LICENSE`、README、`package-lock.json`、依存の `THIRD_PARTY_NOTICES`、校正版では
kuromojiのパッチ記録とNOTICEを含める。mecab-ipadic辞書はkuromoji本体とは別のNAIST-2003条件(ICOT Free
Software由来の条件を含む)なので、GPLv3として一括表示しない。配布物生成時に依存のLICENSEとNOTICEを
再走査し、生成物を目視確認する。

`writing-tools-proofreading-server` の `THIRD_PARTY_NOTICES` では、kuromoji本体(Apache-2.0)のセクション内に
「### NOTICE（同梱データ等への追加条件の可能性、本体ライセンスとは別に保持）」という節を設け、
mecab-ipadic-2.7.0-20070801のNAIST条件をコード本体のGPLv3表示とは独立させ、原文のまま保持している。
この節は `npm run build:server-dist -- proofreading` 実行のたびに自動生成されるため、手動で追記・削除
しないこと。依存を更新した際は、この節が消えていないか再走査時に確認する。

Wasm拡張は `npm run build:rust-notices` でCargo依存の通知を生成する。これはロックされた依存グラフの
通知であり、実際のリンク内容を完全に表すものではない。3拡張とも`extension.toml`に`grammars`が無く
tree-sitter文法のCコンパイル(wasi-sdk/clang)が発生しないため、WASI SDK関連の通知は現状不要。

Rust標準ライブラリ・コンパイラランタイム(std/core/alloc、wasm32-wasip2向けpanic/unwind等)はCargoの
依存グラフに現れず`build:rust-notices`のCargo解析だけでは収録されないため、`scripts/rust-toolchain-notice.txt`
(rust-lang/rustのLICENSE-MIT・LICENSE-APACHE、2026-09-25取得)を`build-rust-notices.js`が生成物末尾に
自動追記する形で別途対応済み。個別サブコンポーネントの完全な内訳はRustのリリースごとに変わりうるため
複製せず、`COPYRIGHT`ファイルへの参照のみ記載している。フォント等の追加資産は現状同梱していないため
該当なし(将来同梱する場合は都度追加で対応する)。

GPLv3の対応するソースは、配布した版と一致する本リポジトリの全ソース、ロックファイル、パッチ、
生成手順である。バイナリだけ、または生成済み `dist/` だけを公開して完了としない。リリースタグと
対応コミットを固定し、第三者のライセンス本文・著作権・NOTICEを改変せず保持する。

このリポジトリのコードはGPL-3.0-or-later。依存は元のMIT、Apache-2.0、BSD、Unicode等の条件を維持する。
個別の辞書・データの条件をコードのGPL表示で上書きしない。
