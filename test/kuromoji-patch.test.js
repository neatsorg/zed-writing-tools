import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import kuromoji from 'kuromoji';
import { patchKuromoji } from '../scripts/patch-kuromoji.js';

const require = createRequire(import.meta.url);
const packageDir = path.dirname(require.resolve('kuromoji/package.json'));

test('both tokenizer APIs preserve unknown astral words and UTF-16 token positions', async () => {
  const tokenizer = await new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: path.join(packageDir, 'dict') }).build((error, value) => error ? reject(error) : resolve(value));
  });
  for (const text of ['😀😀食べれる。𠮷野家です。', '👩‍💻。\r\n😀😀食べれる。', '𠮷𠮷食べれる。', 'あ😀、い😀😀。食べれる。']) {
    for (const method of ['tokenize', 'tokenizeForSentence']) {
      const tokens = tokenizer[method](text);
      assert.equal(tokens.map(token => token.surface_form).join(''), text);
      let offset = 0;
      for (const token of tokens) {
        assert.equal(token.word_position, offset + 1, `${method}: ${text}`);
        assert.equal(text.slice(offset, offset + token.surface_form.length), token.surface_form);
        offset += token.surface_form.length;
      }
    }
  }
});

test('dependency patches are idempotent and reject unexpected sources before writing', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'text-tools-patch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const spec = JSON.parse(await readFile(new URL('../patches/kuromoji-0.1.2.json', import.meta.url), 'utf8'));
  const destination = path.join(root, 'node_modules/kuromoji');
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'package.json'), JSON.stringify({ version: spec.version }));
  for (const file of spec.files) {
    await mkdir(path.dirname(path.join(destination, file.path)), { recursive: true });
    await writeFile(path.join(destination, file.path), await readFile(path.join(packageDir, file.path)));
  }
  await patchKuromoji(root);
  await patchKuromoji(root);
  const target = path.join(destination, spec.files[1].path);
  await writeFile(target, 'unexpected upstream code');
  await assert.rejects(patchKuromoji(root), /Unexpected kuromoji source/);
  assert.equal(await readFile(target, 'utf8'), 'unexpected upstream code');
  await writeFile(path.join(destination, 'package.json'), JSON.stringify({ version: '0.2.0' }));
  await assert.rejects(patchKuromoji(root), /Review kuromoji patch/);
});
