# 開発版の導入と開発

Node.js 22 以降、Rust、`wasm32-wasip2` ターゲットが必要です。

```sh
npm ci --ignore-scripts
npm run patch:deps
npm test
```

開発用拡張とサーバー配布物を生成します。

```sh
npm run build:server-dist -- conversion
npm run deploy:server-dev -- conversion
npm run build:server-dist -- proofreading
npm run deploy:server-dev -- proofreading
npm run build:server-dist -- translation
npm run deploy:server-dev -- translation

cargo build --manifest-path extension-conversion/Cargo.toml --target wasm32-wasip2 --release --locked
cargo build --manifest-path extension-proofreading/Cargo.toml --target wasm32-wasip2 --release --locked
cargo build --manifest-path extension-translation/Cargo.toml --target wasm32-wasip2 --release --locked
```

Zed のコマンドパレットで `zed: install dev extension` を実行し、次のディレクトリを個別に
選択します。

```text
extension-conversion/
extension-proofreading/
extension-translation/
```

サーバーを再生成・再配置した後は、Zedのステータスバーにある言語サーバーメニューから
「すべてのサーバーを再起動」を実行してください。
テスト用のサンプル文書と詳細な検証項目は `examples/`、`test/`、
[`docs/architecture.md`](architecture.md) にあります。
