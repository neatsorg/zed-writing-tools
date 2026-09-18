// 変換拡張のエントリーポイント。校正エンジン（textlint）を import しないことで、
// 変換拡張がその依存を読み込まないようにする。
import { createServer } from './create-server.js';
import { transformations } from '../features/conversion.js';

createServer({ transformations, inspections: [] }).listen();
