// E2E テスト専用の起動スクリプト。製品の各エントリーポイントは features/ の対応する
// モジュールのみを渡すため、ダミー診断を注入する分岐は製品側に持たせず、
// ここで create-server.js を直接呼んで組み立てる。
import { createServer } from '../../src/lsp/create-server.js';
import { transformations } from '../../src/features/conversion.js';
import { dummyInspect } from './dummy-inspection.js';

createServer({ transformations, inspections: [{ id: 'test.word', inspect: dummyInspect }] }).listen();
