// build-server-dist.js・deploy-server-dev.js で共有する、拡張ごとの配布物定義。
// 変換拡張と校正拡張は依存が異なる（校正拡張のみ textlint 系を持つ）ため、対象ごとに
// package.json の dependencies・配布物ディレクトリ名・拡張 ID・起動エントリーポイントを分ける。
export const TARGETS = {
  conversion: {
    extensionId: 'writing-tools',
    distDirName: 'writing-tools-server',
    serverEntry: 'src/lsp/server.js',
    dependencies: ['vscode-languageserver', 'vscode-languageserver-textdocument', 'jaconv'],
  },
  proofreading: {
    extensionId: 'writing-tools-proofreading',
    distDirName: 'writing-tools-proofreading-server',
    serverEntry: 'src/lsp/proofreading-server.js',
    dependencies: [
      'vscode-languageserver', 'vscode-languageserver-textdocument',
      'textlint-rule-preset-japanese', '@textlint/module-interop',
      '@textlint/kernel', '@textlint/textlint-plugin-text', 'kuromoji',
    ],
  },
  translation: {
    extensionId: 'writing-tools-translation',
    distDirName: 'writing-tools-translation-server',
    serverEntry: 'src/lsp/translation-server.js',
    dependencies: ['vscode-languageserver', 'vscode-languageserver-textdocument'],
  },
};
