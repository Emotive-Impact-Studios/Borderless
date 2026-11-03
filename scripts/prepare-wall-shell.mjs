import { cp, mkdir, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
// Keep /app/assets URLs identical in the bundled launcher and served Wall.
await mkdir(new URL('wall-shell/frontend', root), { recursive: true });
await rm(new URL('wall-shell/frontend/app', root), { recursive: true, force: true });
await cp(new URL('web/dist', root), new URL('wall-shell/frontend/app', root), { recursive: true });
await copyFile(new URL('web/dist/index.html', root), new URL('wall-shell/frontend/index.html', root));
console.log(`Prepared shared Wall assets in ${fileURLToPath(new URL('wall-shell/frontend', root))}`);
