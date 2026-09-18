# kuromoji 0.1.2: UTF-16 positions

These patches modify the Node implementation of kuromoji 0.1.2, from
https://github.com/takuyaa/kuromoji.js (Apache-2.0). The original source retains
its copyright and license headers. Text Tools changes are marked in the files.

- `Tokenizer.js`: convert the lattice's one-based code-point starts into
  one-based UTF-16 starts before returning tokens. This covers both kuromojin's
  cached `tokenize` and rules calling `getTokenizer().tokenizeForSentence`.
- `ViterbiBuilder.js`: measure grouped unknown words in code points, just like
  the rest of the lattice. Otherwise adjacent astral characters can consume
  following Japanese characters, so correcting positions alone is insufficient.

Apply with `npm run patch:deps` after `npm ci --ignore-scripts`. Ordinary
installation, `npm test`, and `npm start` also apply the patch. The distribution
builder applies it explicitly after its own `npm ci --ignore-scripts` and ships
this directory as a record of the modifications. The conversion distribution
does not contain kuromoji or these patches.

`kuromoji-0.1.2.json` pins the upstream version and SHA-256 hashes before and
after each patch. Reapplication is idempotent; unexpected sources fail closed.
When updating dependencies, review the upstream fixes and all seven rule
regressions before changing/removing this patch. Do not carry the marker into
a different upstream version without that review.

No input characters, dictionary entries, rule options or final textlint ranges
are replaced. The public token position contract is intentionally changed for
this application's textlint consumers; this is not a general upstream release.
