import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const patchesDir = new URL('../patches/', import.meta.url);
const digest = text => createHash('sha256').update(text).digest('hex');

// Exact version and before/after hashes prevent silently patching an upstream update.
// All files are checked before writing. Re-running after an interrupted write is safe.
export async function patchKuromoji(root) {
  const require = createRequire(path.join(root, 'package.json'));
  const packageFile = require.resolve('kuromoji/package.json');
  const packageDir = path.dirname(packageFile);
  const pkg = JSON.parse(await readFile(packageFile, 'utf8'));
  const spec = JSON.parse(await readFile(new URL('kuromoji-0.1.2.json', patchesDir), 'utf8'));
  if (pkg.version !== spec.version) throw new Error(`Review kuromoji patch for version ${pkg.version}`);
  const writes = [];
  for (const file of spec.files) {
    const target = path.join(packageDir, file.path);
    const original = await readFile(target, 'utf8');
    if (digest(original) === file.after) continue;
    if (digest(original) !== file.before) throw new Error(`Unexpected kuromoji source: ${file.path}`);
    const patch = await readFile(new URL(file.patch, patchesDir), 'utf8');
    let updated = original;
    for (const hunk of patch.split(/^@@.*@@.*\n/m).slice(1)) {
      const lines = hunk.split('\n').filter(line => /^[ +\-]/.test(line));
      const before = lines.filter(line => line[0] !== '+').map(line => line.slice(1) + '\n').join('');
      const after = lines.filter(line => line[0] !== '-').map(line => line.slice(1) + '\n').join('');
      if (!updated.includes(before) || updated.indexOf(before) !== updated.lastIndexOf(before)) {
        throw new Error(`Ambiguous kuromoji patch: ${file.path}`);
      }
      updated = updated.replace(before, after);
    }
    if (digest(updated) !== file.after) throw new Error(`Invalid kuromoji patch: ${file.path}`);
    writes.push([target, updated]);
  }
  for (const [target, updated] of writes) await writeFile(target, updated);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await patchKuromoji(fileURLToPath(new URL('../', import.meta.url)));
}
