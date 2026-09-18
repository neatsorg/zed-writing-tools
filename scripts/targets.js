// build-server-dist.js・deploy-server-dev.js で共有する、拡張ごとの配布物定義。
// 変換拡張と校正拡張は依存が異なる（校正拡張のみ textlint 系を持つ）ため、対象ごとに
// package.json の dependencies・配布物ディレクトリ名・拡張 ID・起動エントリーポイントを分ける。
export const TARGETS = {
  conversion: {
    extensionId: 'text-tools',
    distDirName: 'text-tools-server',
    serverEntry: 'src/lsp/server.js',
    dependencies: ['vscode-languageserver', 'vscode-languageserver-textdocument', 'jaconv'],
  },
  proofreading: {
    extensionId: 'text-tools-proofreading',
    distDirName: 'text-tools-proofreading-server',
    serverEntry: 'src/lsp/proofreading-server.js',
    dependencies: [
      'vscode-languageserver', 'vscode-languageserver-textdocument',
      'textlint', 'textlint-rule-preset-japanese', '@textlint/module-interop',
    ],
  },
};
