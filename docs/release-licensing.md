# リリース時のライセンス確認

確認日: 2026-09-21。対象は `zed-writing-tools` のサーバー3種とWasm拡張2種。

サーバー配布物は `npm run build:server-dist -- conversion|proofreading|translation` で生成する。
各配布物には `LICENSE`、README、`package-lock.json`、依存の `THIRD_PARTY_NOTICES`、校正版では
kuromojiのパッチ記録とNOTICEを含める。mecab-ipadic辞書はkuromoji本体とは別のNAIST-2003条件なので、
GPLv3として一括表示しない。配布物生成時に依存のLICENSEとNOTICEを再走査し、生成物を目視確認する。

Wasm拡張は `npm run build:rust-notices` でCargo依存の通知を生成する。これはロックされた依存グラフの
通知であり、実際のリンク内容を完全に表すものではない。Rust標準ライブラリ、WASI runtime、フォント、
その他の資産を含むリリースでは、それぞれの通知も最終アーカイブに追加する。

GPLv3の対応するソースは、配布した版と一致する本リポジトリの全ソース、ロックファイル、パッチ、
生成手順である。バイナリだけ、または生成済み `dist/` だけを公開して完了としない。リリースタグと
対応コミットを固定し、第三者のライセンス本文・著作権・NOTICEを改変せず保持する。

このリポジトリのコードはGPL-3.0-or-later。依存は元のMIT、Apache-2.0、BSD、Unicode等の条件を維持する。
個別の辞書・データの条件をコードのGPL表示で上書きしない。
