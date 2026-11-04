import { mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// PDF pages on the native Wall use PDFium (Chromium's PDF engine, BSD-3-Clause)
// from the pinned bblanchon/pdfium-binaries release (MIT packaging). The
// archive is verified against the recorded SHA-256 before it is unpacked.
const release = 'chromium/8125';
const pinned = {
  'darwin-arm64': ['pdfium-mac-arm64.tgz', '4939bd935ac83ddc09a3a4f038bc43a19cea1660316a3667f26cb07a070e139d'],
};
const key = `${process.platform}-${process.arch}`;
const entry = pinned[key];
if (!entry) throw new Error(`No pinned PDFium for ${key} yet. Add its archive and SHA-256 here.`);
const [archive, sha] = entry;
const root = fileURLToPath(new URL('..', import.meta.url));
const dir = join(root, 'wall/vendor/pdfium', key);
const response = await fetch(`https://github.com/bblanchon/pdfium-binaries/releases/download/${release}/${archive}`);
if (!response.ok) throw new Error(`PDFium download failed (${response.status}).`);
const bytes = Buffer.from(await response.arrayBuffer());
const actual = createHash('sha256').update(bytes).digest('hex');
if (actual !== sha) throw new Error(`PDFium archive hash mismatch: ${actual}`);
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
const file = join(dir, archive);
await writeFile(file, bytes);
const untar = spawnSync('tar', ['-xzf', file, '-C', dir], { stdio: 'inherit' });
if (untar.status !== 0) throw new Error('PDFium archive did not unpack.');
await rm(file);
console.log(`PDFium ${release} for ${key}: ${dir}`);
