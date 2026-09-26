# Zed Writing Tools

Japanese writing assistance for [Zed](https://zed.dev), provided as three independent extensions for `Plain Text` and `.txt` files.

日本語版: [README.ja.md](README.ja.md)

## Extensions

- **Writing Tools Conversion** — Convert alphanumeric characters, symbols, kana, and hiragana between full-width and half-width forms.
- **Writing Tools Proofreading** — Show Japanese proofreading diagnostics using textlint's `preset-japanese` rules.
- **Writing Tools Translation** — Translate selected text between Japanese and English using DeepL.

Each extension can be installed separately. Features are available through Zed Code Actions, normally bound to `Ctrl+.`.

## Installation

These extensions are not yet available in Zed's official Extension Gallery. Until then, install them as "dev extensions" following the steps below (this will no longer be necessary once they're accepted into the registry).

### 1. Download the extension

From the [GitHub Release](https://github.com/neatsorg/zed-writing-tools/releases/latest), download `writing-tools-<conversion|proofreading|translation>-extension-<version>.tar.gz` for the extension you want, and extract it anywhere.

### 2. Set up a Rust toolchain

When installing a dev extension, Zed always recompiles it from source — even if a prebuilt `extension.wasm` is already present in the folder. Install the following on the machine running Zed beforehand:

- [rustup](https://rustup.rs/) (the `wasm32-wasip2` target is added automatically by Zed as long as rustup itself is present)

If you use zsh, rustup's installer also appends its setup to `~/.zshenv`, so a Zed instance launched from a GUI launcher (not a terminal) will pick it up too.

### 3. Install into Zed

Open the Zed menu → Extensions (default shortcut: `Ctrl+Shift+X`, macOS: `Cmd+Shift+X`) and choose "Install Dev Extension", or run `zed: install dev extension` from the command palette. In the folder picker, select the folder from step 1 that contains `extension.toml`.

Zed compiles it on the spot, so this may take a moment.

### 4. About the language server

After installation, on its first start the extension automatically downloads the matching language server from the same [GitHub Release](https://github.com/neatsorg/zed-writing-tools/releases). A network connection and permission to download are required.

On a restricted network, you can skip this automatic download by manually downloading `writing-tools-<name>-server-<version>.tar.gz` from the same release and extracting it to:

```
~/.local/share/zed/extensions/work/writing-tools-<name>/writing-tools-<name>-server/<version>/
```

### After official registry acceptance

Once accepted into the official registry, the extension will be installable by searching Zed's Extension Gallery — no Rust toolchain required in that case.

---

For building the server and extensions entirely from source (e.g. for development), see [Development](docs/development.md).

## DeepL API key

The Translation extension requires a DeepL API key in the environment of the machine running Zed:

```sh
export DEEPL_AUTH_KEY="your-api-key"
```

Do not store the key in a repository or in a configuration file that can be accessed by others. For pricing, usage limits, and data handling, see [DeepL's Terms of Use](https://www.deepl.com/en/pro-license) and [Privacy Policy](https://www.deepl.com/en/privacy).

## Limitations

### Unsaved buffers

Edits in a file that has been saved at least once can be processed even when the latest edits are not saved. A new `Untitled` buffer that has never been saved may not be registered with Zed's language server, and therefore may not be supported.

### Proofreading size limit

Five sentence-level rules (`max-ten`, `no-doubled-conjunctive-particle-ga`, `no-doubled-conjunction`, `no-doubled-joshi`, and `sentence-length`) are skipped for documents over 30,000 characters because they can be slow. The extension uses the bundled `preset-japanese` rules and does not read a project's `.textlintrc`.

### Settings

The enabled state, diagnostic delay, and individual items or rules can be configured through `lsp.<extension-id>.initialization_options` in `settings.json`. Proofreading diagnostics use a 1000 ms delay by default; set `diagnostics.delay` to another non-negative integer to change it. After changing these settings, restart all language servers from the language-server menu in the status bar.

See the [architecture notes](docs/architecture.md) for the configuration details and design rationale. The Japanese documentation also contains complete configuration examples in [README.ja.md](README.ja.md).

## License

Original code in this project is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE). npm and Cargo dependencies remain subject to their respective license terms; distributed server archives include `THIRD_PARTY_NOTICES` and required notices.

Source code, lockfiles, patches, and build instructions for the distributed versions are available in this repository. See the [release and license audit notes](docs/release-licensing.md) for details.
