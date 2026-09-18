// 校正拡張のエントリーポイント。変換エンジンは transformations として渡さないため、
// 校正拡張は変換用の Code Action を提供しない。
import { createServer } from './create-server.js';
import { inspections } from '../features/proofreading.js';

createServer({ transformations: [], inspections }).listen();
