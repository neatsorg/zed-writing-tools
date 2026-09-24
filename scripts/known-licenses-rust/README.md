# 個別に確認済みの Rust crate ライセンス全文

crate のソース（`~/.cargo/registry/src/.../<name>-<version>/`）に LICENSE 系ファイルが
同梱されていない場合に使う（2026-09-19、GitHub の該当リポジトリから取得）。
`scripts/build-rust-notices.js` が、crate 内の LICENSE 系ファイルの次にここを確認する。

命名: `<crate名>@<version>-<選択した SPDX ID>.txt`。crate は `Cargo.lock` のバージョンに
固定されているため、バージョンを含めて追跡する（アップデート時は差分の見直しが必要）。

| ファイル | 由来 |
| --- | --- |
| `wasm-encoder@0.227.1-*.txt`、`wasm-metadata@0.227.1-*.txt`、`wasmparser@0.227.1-*.txt`、`wit-component@0.227.1-*.txt`、`wit-parser@0.227.1-*.txt` | bytecodealliance/wasm-tools（モノレポ、ルートの LICENSE-APACHE・LICENSE-MIT。crate 個別のものではない） |
| `wit-bindgen*@0.41.0-*.txt` | bytecodealliance/wit-bindgen（モノレポ、ルートの LICENSE-APACHE・LICENSE-MIT） |
| `auditable-serde@0.8.0-*.txt` | rust-secure-code/cargo-auditable |

選択方針: `license` フィールドが SPDX の `OR` 式の場合、Apache-2.0 を優先し
（GPLv3 との互換性が明確、`docs/license-audit.md` 参照）、無ければ MIT を選ぶ。
`AND` で結合された各項目は選択ではなく全項目を収録する（`unicode-ident` の
`(MIT OR Apache-2.0) AND Unicode-3.0` は Apache-2.0 と Unicode-3.0 の両方）。

## Rust標準ライブラリ本体について

`../rust-toolchain-notice.txt`（このディレクトリの1つ上）に、Cargo依存グラフには現れない
Rust標準ライブラリ・コンパイラランタイム(std/core/alloc、wasm32-wasip2向けpanic/unwind等)
のライセンス通知を別途収録している。2026-09-25、rust-lang/rustリポジトリの
`LICENSE-MIT`・`LICENSE-APACHE`から取得（著作権者: The Rust Project Contributors）。
`build-rust-notices.js`が生成物の末尾に自動で追記する。個別サブコンポーネントの完全な内訳は
参照先として`COPYRIGHT`ファイルのURLを記載するに留め、本文は複製していない
(Rustのリリースごとに変わりうるため)。
