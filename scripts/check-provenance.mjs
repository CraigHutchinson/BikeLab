import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

for (const dir of await readdir('dist/vendor', {withFileTypes: true})) {
  if (!dir.isDirectory()) continue;
  const root = join('dist/vendor', dir.name);
  const manifest = JSON.parse(await readFile(join(root, 'provenance.json'), 'utf8'));
  if (!Object.keys(manifest.files ?? {}).length) throw new Error(`${root}: no file hashes`);
  for (const [file, expected] of Object.entries(manifest.files)) {
    const actual = createHash('sha256').update(await readFile(join(root, file))).digest('hex');
    if (actual !== expected) throw new Error(`${root}/${file}: provenance hash mismatch`);
  }
  console.log(`${root}: ${Object.keys(manifest.files).length} SHA-256 hashes verified`);
}
