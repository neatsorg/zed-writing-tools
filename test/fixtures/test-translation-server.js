// E2E テスト専用の起動スクリプト。create-server.js の翻訳（command 経由の実行）まわりだけを
// 検証するため、変換・校正エンジンは注入せず、ダミー翻訳プロバイダーだけを渡す。
import { createServer } from '../../src/lsp/create-server.js';
import { throwingTranslate, workingTranslate, delayedTranslate } from './dummy-translation.js';

createServer({
  transformations: [],
  inspections: [],
  translations: [
    { id: 'test.translate.throwing', title: 'throwing', translate: throwingTranslate },
    { id: 'test.translate.working', title: 'working', translate: workingTranslate },
    // throwingTranslate を使うことで、サイズガードが provider.translate 呼び出し前に
    // 効いていない場合はテストが例外で検知できる。
    { id: 'test.translate.sized', title: 'sized', translate: throwingTranslate, maxTextBytes: 4 },
    { id: 'test.translate.slow', title: 'slow', translate: delayedTranslate(100) },
  ],
}).listen();
