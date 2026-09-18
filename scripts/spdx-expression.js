// SPDX ライセンス式（npm より複雑で AND を含む Rust crate 側で必要）を解析し、
// AND で結合された OR グループの配列に変換する。
// 例: "(MIT OR Apache-2.0) AND Unicode-3.0" -> [["MIT","Apache-2.0"], ["Unicode-3.0"]]
// 例: "MIT OR Apache-2.0" -> [["MIT","Apache-2.0"]]
// スラッシュ区切り（"MIT/Apache-2.0" のような古い表記）も OR として扱う。
// OR の中に AND が入る式（例: "(A AND B) OR C"）は今回の依存には出現せず、未対応（エラー）。
export function parseSpdxExpression(expr) {
  const tokens = expr.replace(/\//g, ' OR ').match(/\(|\)|AND|OR|WITH|[A-Za-z0-9.\-+]+/g) ?? [];
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parsePrimary() {
    if (peek() === '(') {
      consume();
      const inner = parseAndExpr();
      if (consume() !== ')') throw new Error(`不正な SPDX 式（括弧不整合）: ${expr}`);
      return inner;
    }
    let id = consume();
    if (id === undefined) throw new Error(`不正な SPDX 式: ${expr}`);
    if (peek() === 'WITH') {
      consume();
      const exception = consume();
      id = `${id} WITH ${exception}`;
    }
    return [[id]];
  }

  function parseOrExpr() {
    let result = parsePrimary();
    while (peek() === 'OR') {
      consume();
      const next = parsePrimary();
      if (result.length !== 1 || next.length !== 1) {
        throw new Error(`未対応の SPDX 式（OR 内に AND が混在）: ${expr}`);
      }
      result = [[...result[0], ...next[0]]];
    }
    return result;
  }

  function parseAndExpr() {
    let result = parseOrExpr();
    while (peek() === 'AND') {
      consume();
      result = [...result, ...parseOrExpr()];
    }
    return result;
  }

  const result = parseAndExpr();
  if (pos !== tokens.length) throw new Error(`不正な SPDX 式（余分なトークン）: ${expr}`);
  return result;
}
