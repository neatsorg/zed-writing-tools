# リリース手順

拡張とサーバーは初版では同じバージョンで管理します。次の版を出すときは、
`package.json`、3つの `extension.toml`、3つの Rust `Cargo.toml`、拡張の Rust ソースにある
`SERVER_VERSION`・`RELEASE_TAG`・`RELEASE_ASSET` を同じ版へ更新します。

更新後にローカルで確認します。

```sh
npm ci --ignore-scripts
npm run patch:deps
npm test
npm run build:server-dist -- conversion
npm run build:server-dist -- proofreading
npm run build:server-dist -- translation
cargo build --manifest-path extension-conversion/Cargo.toml --target wasm32-wasip2 --release --locked
cargo build --manifest-path extension-proofreading/Cargo.toml --target wasm32-wasip2 --release --locked
cargo build --manifest-path extension-translation/Cargo.toml --target wasm32-wasip2 --release --locked
```

対応するコミットを push してから、`v<version>` タグを push します。
GitHub Actions がサーバー配布物3種、SHA256SUMS、リリースノートを GitHub Release に作成します。

```sh
git tag v0.1.0
git push origin v0.1.0
```

GitHub Release のアーカイブ名と SHA256SUMS を確認してから、Zed の公式拡張レジストリへ
拡張を個別に提出します。レジストリ側の `version` は各 `extension.toml` と一致させます。
