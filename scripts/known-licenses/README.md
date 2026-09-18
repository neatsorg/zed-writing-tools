# 個別に確認済みのライセンス全文

npm パッケージに LICENSE 系ファイルが同梱されておらず、`README` にも全文が無いため、
著作権者を `author` フィールドやリポジトリ所有者から推測することを避け（推測は不正確に
なりうる。例: `imurmurhash` の `author` は 1 名だが、実際の著作権表示は 2 名連名。
`docs/license-audit.md` 参照）、上流リポジトリの現在の LICENSE を個別に確認して保存した
（2026-09-19、GitHub API の `GET /repos/{owner}/{repo}/license` で取得）。

`scripts/build-server-dist.js` は、LICENSE 系ファイル・README 内の全文検出の次に、
ここのファイル（`<package name>.txt`）を優先して使う。ここにも無い場合は、
`scripts/license-texts/`（SPDX 標準テキスト、著作権者不明のまま）にフォールバックせず、
ビルドを失敗させる（次のパッケージバージョンでの取りこぼしを防ぐため）。

| パッケージ | 取得元リポジトリ |
| --- | --- |
| bail | wooorm/bail |
| boundary | textlint/boundary |
| ccount | wooorm/ccount |
| comma-separated-tokens | wooorm/comma-separated-tokens |
| escape-string-regexp | sindresorhus/escape-string-regexp |
| hast-util-from-parse5 | syntax-tree/hast-util-from-parse5 |
| hast-util-parse-selector | syntax-tree/hast-util-parse-selector |
| hastscript | syntax-tree/hastscript |
| imurmurhash | README（jensyt/imurmurhash-js）から抽出。`author` は Jens Taylor のみだが実際は Gary Court・Jens Taylor の連名 |
| is-plain-obj | sindresorhus/is-plain-obj |
| lru_map | rsms/js-lru |
| ms | vercel/ms |
| property-information | wooorm/property-information |
| rehype-parse | rehypejs/rehype（モノレポ、サブパッケージ） |
| space-separated-tokens | wooorm/space-separated-tokens |
| structured-source | textlint/structured-source |
| textlint-rule-no-kangxi-radicals | README（xl1/textlint-rule-no-kangxi-radicals）の「MIT © xl1」から SPDX MIT 標準テキストを補完 |
| trough | wooorm/trough |
| unist-util-is | syntax-tree/unist-util-is |
| unist-util-stringify-position | syntax-tree/unist-util-stringify-position |
| unist-util-visit | syntax-tree/unist-util-visit |
| unist-util-visit-parents | syntax-tree/unist-util-visit-parents |
| vfile | vfile/vfile |
| vfile-message | vfile/vfile-message |
| web-namespaces | wooorm/web-namespaces |

いずれも「現在のデフォルトブランチの LICENSE」であり、配布物にインストールされている
バージョン時点の LICENSE と一言一句同一である保証はない（著作権表示は通常変わらないが、
依存バージョンを更新した際は差分を確認すること）。`kuromoji`（Apache-2.0、本文に著作権者
記載欄が無い）はここに含めず、`scripts/license-texts/Apache-2.0.txt` をそのまま使う。
