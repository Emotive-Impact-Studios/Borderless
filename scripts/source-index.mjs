import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const sourceURL = new URL('../docs/source/2026-11-03-original-conversation.md', import.meta.url);
const indexURL = new URL('../docs/source/code-index.json', import.meta.url);
const bytes = await readFile(sourceURL);
// Keep line endings and escaping exactly as archived; index, never rewrite, the source.
const lines = bytes.toString('utf8').match(/[^\n]*\n|[^\n]+$/g);
const languages = new Set(['go', 'rust', 'csharp', 'cpp', 'c++', 'glsl', 'html', 'javascript', 'js', 'dart', 'sql', 'bash', 'batch', 'pascal', 'toml', 'json', 'text', 'css', 'python', 'yaml']);
const destinations = {
  go: 'native/hub/', rust: 'native/core/', csharp: 'native/wall/', cpp: 'native/windows/',
  'c++': 'native/windows/', glsl: 'native/wall/', html: 'public/', javascript: 'public/',
  js: 'public/', dart: 'native/mobile (planned)', sql: 'native/hub/', bash: 'scripts/',
  batch: 'native/windows/', pascal: 'native/windows/', toml: 'native/core/',
};
const blocks = [];
for (let i = 0; i < lines.length; i++) {
  const language = lines[i].trim();
  if (!languages.has(language)) continue;
  const end = lines.findIndex((line, n) => n > i && line.trim() === 'Use code with caution.');
  if (end < 0) throw new Error(`No end delimiter for source line ${i + 1}`);
  const raw = lines.slice(i + 1, end).join('');
  blocks.push({ id: `SRC-${String(blocks.length + 1).padStart(3, '0')}`, language,
    markerLine: i + 1, firstLine: i + 2, lastLine: end, endMarkerLine: end + 1,
    sha256: createHash('sha256').update(raw).digest('hex'),
    destination: destinations[language] || 'docs/SOURCE_AUDIT.md',
    disposition: 'Historical reference; reimplement intent against PRD and SOURCE_AUDIT, never execute verbatim.' });
  i = end;
}
const index = { source: 'docs/source/2026-11-03-original-conversation.md',
  sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
  lineCount: lines.length, blocks };
const rendered = JSON.stringify(index, null, 2) + '\n';
if (process.argv.includes('--write')) await writeFile(indexURL, rendered);
else if (await readFile(indexURL, 'utf8') !== rendered) throw new Error('Source code index differs; inspect the archive before regenerating.');
console.log(`Verified ${blocks.length} historical code blocks and ${lines.length} original lines.`);
