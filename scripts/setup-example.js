import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Generate machine-local Zed settings. Never overwrite an existing configuration.
const directory = new URL('../examples/.zed/', import.meta.url);
const target = new URL('settings.json', directory);
const settings = {
  lsp: {
    'writing-tools': {
      binary: {
        path: process.execPath,
        arguments: [fileURLToPath(new URL('../src/lsp/server.js', import.meta.url)), '--stdio'],
      },
    },
  },
  languages: { 'Plain Text': { language_servers: ['writing-tools', '...'] } },
};

await mkdir(directory, { recursive: true });
try {
  await writeFile(target, JSON.stringify(settings, null, 2) + '\n', { flag: 'wx' });
  console.log('Created examples/.zed/settings.json for this installation.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Kept existing examples/.zed/settings.json. Rename it first to regenerate.');
}
