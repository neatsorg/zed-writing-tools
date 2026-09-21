# Zed Writing Tools

Japanese writing assistance for [Zed](https://zed.dev), provided as three independent extensions for `Plain Text` and `.txt` files.

日本語版: [README.ja.md](README.ja.md)

## Extensions

- **Writing Tools Conversion** — Convert alphanumeric characters, symbols, kana, and hiragana between full-width and half-width forms.
- **Writing Tools Proofreading** — Show Japanese proofreading diagnostics using textlint's `preset-japanese` rules.
- **Writing Tools Translation** — Translate selected text between Japanese and English using DeepL.

Each extension can be installed separately. Features are available through Zed Code Actions, normally bound to `Ctrl+.`.

## Installation

Open Zed's Extension Gallery with `Ctrl+Shift+X` (macOS: `Cmd+Shift+X`), search for the extension you need, and install it.

On the first language-server start, the extension automatically downloads the required server from the project's [GitHub Release](https://github.com/neatsorg/zed-writing-tools/releases). A network connection and permission to download the server are required.

For development or manual testing, see [Development](docs/development.md).

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

The enabled state and individual items or rules can be configured through `lsp.<extension-id>.initialization_options` in `settings.json`. After changing these settings, restart all language servers from the language-server menu in the status bar.

See the [architecture notes](docs/architecture.md) for the configuration details and design rationale. The Japanese documentation also contains complete configuration examples in [README.ja.md](README.ja.md).

## License

Original code in this project is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE). npm and Cargo dependencies remain subject to their respective license terms; distributed server archives include `THIRD_PARTY_NOTICES` and required notices.

Source code, lockfiles, patches, and build instructions for the distributed versions are available in this repository. See the [release and license audit notes](docs/release-licensing.md) for details.
