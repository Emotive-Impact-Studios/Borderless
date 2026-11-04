// Run on the hub with a trusted test certificate and an explicit room-interface IP.
// All credentials, rooms and listeners belong to this disposable commissioning run.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';
import { createApp } from '../server/app.mjs';
import { startMediaProcess } from '../server/media-process.mjs';
import { room, wall, command, request, snapshot } from '../test/helpers.mjs';

const address = process.env.BORDERLESS_MEDIA_RTC_ADDRESS;
const cert = process.env.BORDERLESS_TLS_CERT;
const key = process.env.BORDERLESS_TLS_KEY;
assert.ok(address && cert && key, 'Set the room-interface IPv4 address and certificate paths.');
const signalURL = `wss://${address}:17443`;
const base = `https://${address}:17443`;
const dataDir = await mkdtemp(join(tmpdir(), 'bl-lan-check-'));
let media, hub, proxy, signal;
try {
  media = await startMediaProcess({ dataDir, signalURL, rtcAddress: address, port: 17880, tcpPort: 17881, udpPort: 17882 });
  const rtcTCP = connect({host:address, port:17881});
  try { await once(rtcTCP, 'connect', {signal:AbortSignal.timeout(3000)}); }
  finally { rtcTCP.destroy(); }
  proxy = spawn(process.env.CADDY || 'caddy', ['run', '--config', 'deploy/Caddyfile.media', '--adapter', 'caddyfile'], {
    env: { ...process.env, BORDERLESS_MEDIA_HOST: address, BORDERLESS_MEDIA_BIND: address,
      BORDERLESS_MEDIA_TLS_PORT: '17443', BORDERLESS_MEDIA_UPSTREAM_PORT: '17880' }, stdio: 'ignore'
  });
  await once(proxy, 'spawn');
  for (let i = 0; i < 50; i++) {
    if (proxy.exitCode !== null) throw new Error('TLS proxy exited before becoming ready.');
    try { if ((await fetch(base)).status === 404) break; } catch { /* Listener still starting. */ }
    await delay(100);
  }
  assert.equal((await fetch(base + '/twirp/livekit.RoomService/ListRooms', {method:'POST'})).status, 404);
  assert.equal((await fetch(base + '/rtc/validate')).status, 401);
  hub = await createApp({ host: address, port: 0, dataDir, cert, key, media });
  hub.base = hub.localURL;
  const {admin} = await room(hub);
  const viewer = (await wall(hub, admin)).actor;
  assert.equal((await command(hub, admin, 'stream.start', {title:'LAN transport check'})).status, 200);
  const id = (await snapshot(hub, admin)).streams[0].id;
  const grant = await request(hub, `/api/rooms/${admin.roomId}/streams/${id}/media`, { method:'POST', actor:viewer, data:{} });
  assert.equal(grant.status, 200);
  assert.equal(grant.body.url, signalURL);
  const validation = await fetch(base + '/rtc/validate', {
    headers: { Authorization: 'Bearer ' + grant.body.token, Origin: hub.base }
  });
  assert.equal(validation.status, 200);
  assert.ok(['*', hub.base].includes(validation.headers.get('access-control-allow-origin')));
  signal = new WebSocket(signalURL + '/rtc?protocol=15', { headers: {Authorization: 'Bearer ' + grant.body.token}, handshakeTimeout: 5000 });
  const [message] = await once(signal, 'message', { signal: AbortSignal.timeout(5000) });
  assert.ok(message.length);
  const revoked = once(signal, 'close', { signal: AbortSignal.timeout(8000) });
  assert.equal((await command(hub, admin, 'stream.stop', {streamId:id})).status, 200);
  await revoked;
  console.log('LAN-interface HTTPS room and pairing, trusted WSS grant and signalling, denied anonymous/control routes, and Stop disconnect passed.');
} finally {
  signal?.terminate();
  if (proxy?.pid && proxy.exitCode === null && proxy.signalCode === null) {
    const closed = once(proxy, 'exit'); proxy.kill('SIGTERM'); await closed;
  }
  try { await hub?.close(); } finally { await media?.close(); await rm(dataDir, {recursive:true, force:true}); }
}
