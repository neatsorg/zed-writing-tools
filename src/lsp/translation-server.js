// 翻訳拡張のエントリーポイント。変換・校正エンジンを import しないことで、
// 翻訳拡張がそれらの依存を読み込まないようにする。
import { createServer } from './create-server.js';
import { translations } from '../features/translation.js';

createServer({ transformations: [], inspections: [], translations }).listen();
