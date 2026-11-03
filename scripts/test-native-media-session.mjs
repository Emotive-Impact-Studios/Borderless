import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createApp } from '../server/app.mjs';
import { startMediaProcess } from '../server/media-process.mjs';
import { room, snapshot } from '../test/helpers.mjs';

const dataDir = await mkdtemp(join(tmpdir(), 'borderless-swift-media-'));
let media, app;
try {
  media = await startMediaProcess({ dataDir, port: 17880, tcpPort: 17881, udpPort: 17882 });
  app = await createApp({ dataDir, port: 0, media });
  app.base = app.localURL;
  const { admin, state } = await room(app);
  const status = await new Promise((resolve, reject) => {
    const child = spawn('swift', ['test', '--package-path', 'native/macos', '--disable-keychain', '--filter', 'HubSessionTests'], {
      stdio: 'inherit', env: { ...process.env, BORDERLESS_TEST_ORIGIN: app.localURL,
        BORDERLESS_TEST_ROOM: admin.roomId, BORDERLESS_TEST_CODE: state.joinCode },
    });
    const timeout = setTimeout(() => child.kill('SIGTERM'), 180_000);
    child.once('error', reject);
    child.once('exit', code => { clearTimeout(timeout); resolve(code); });
  });
  assert.equal(status, 0, 'Swift room integration failed');
  const deadline = Date.now() + 3000;
  while ((await snapshot(app, admin)).streams.length && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal((await snapshot(app, admin)).streams.length, 0);
  while ((await media.service.listRooms()).length && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal((await media.service.listRooms()).length, 0);
  console.log('Real Swift client: cookie join, live connection, publisher grant and Stop passed. No captured video delivery claimed.');
} finally {
  try { await app?.close(); }
  finally { await media?.close(); await rm(dataDir, { recursive: true, force: true }); }
}
