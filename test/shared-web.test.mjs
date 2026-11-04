import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, room, request } from './helpers.mjs';

test('shared Wall serves built assets on the hub origin without exposing sources', async t => {
  const app = await fixture(t);
  const { roomId } = await room(app);
  const page = await request(app, `/app/wall/${roomId}`);
  assert.equal(page.status, 200);
  const html = page.body.toString();
  assert.match(html, /Shared Wall/);
  const script = html.match(/src="(\/app\/assets\/[^" ]+\.js)"/)[1];
  const asset = await request(app, script);
  assert.equal(asset.status, 200);
  assert.match(asset.response.headers.get('content-type'), /javascript/);
  for (const path of ['/app/src/main.ts', '/app/package.json', '/app/assets/..%2fpackage.json', '/app/wall/short']) {
    assert.equal((await request(app, path)).status, 404);
  }
  assert.equal((await request(app, `/app/console/${roomId}`)).status, 200);
});

test('display pairing opens the shared Wall, and old Wall links are redirected to it', async t => {
  const app = await fixture(t);
  const { admin, roomId } = await room(app);
  const pair = await request(app, `/api/rooms/${roomId}/pair`, { method: 'POST', data: {}, actor: admin });
  assert.equal(new URL(pair.body.url).pathname, `/app/wall/${roomId}`);
  const old = await fetch(`${app.base}/wall/${roomId}`, { redirect: 'manual' });
  assert.equal(old.status, 302);
  assert.equal(old.headers.get('location'), `/app/wall/${roomId}`);
});

test('a PDF page turn is shared by the hub so the Console and Wall stay in step', async t => {
  const { participant, wall, command, snapshot, upload } = await import('./helpers.mjs');
  const app = await fixture(t);
  const { admin } = await room(app);
  const owner = await participant(app, admin, 'Owner');
  const other = await participant(app, admin, 'Other');
  const { actor: display } = await wall(app, admin);
  const pdf = Buffer.from('%PDF-1.4\n%%EOF\n');
  assert.equal((await upload(app, owner, 'pages.pdf', pdf)).status, 201);
  let file = (await snapshot(app, admin)).items.find(i => i.title === 'pages.pdf');
  assert.equal((await command(app, other, 'item.page', { itemId: file.id, version: file.version, page: 2 })).status, 403);
  assert.equal((await command(app, display, 'item.page', { itemId: file.id, version: file.version, page: 2 })).status, 403);
  assert.equal((await command(app, owner, 'item.page', { itemId: file.id, version: file.version, page: 0 })).status, 400);
  assert.equal((await command(app, owner, 'item.page', { itemId: file.id, version: file.version, page: 2 })).status, 200);
  assert.equal((await snapshot(app, display)).items.find(i => i.id === file.id).page, 2);
  file = (await snapshot(app, admin)).items.find(i => i.id === file.id);
  assert.equal((await command(app, admin, 'item.page', { itemId: file.id, version: file.version, page: 1 })).status, 200);
  assert.equal((await snapshot(app, owner)).items.find(i => i.id === file.id).page, 1);
});

test('a video file plays and pauses for the whole room from its owner or the leader', async t => {
  const { participant, wall, command, snapshot, upload } = await import('./helpers.mjs');
  const app = await fixture(t);
  const { admin } = await room(app);
  const owner = await participant(app, admin, 'Owner');
  const other = await participant(app, admin, 'Other');
  const { actor: display } = await wall(app, admin);
  // Smallest valid MP4 signature: an ftyp box.
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(12)]);
  assert.equal((await upload(app, owner, 'clip.mp4', mp4)).status, 201);
  let file = (await snapshot(app, admin)).items.find(i => i.title === 'clip.mp4');
  assert.equal((await command(app, other, 'item.play', { itemId: file.id, version: file.version, playing: true, position: 0 })).status, 403);
  assert.equal((await command(app, owner, 'item.play', { itemId: file.id, version: file.version, playing: true, position: -1 })).status, 400);
  assert.equal((await command(app, owner, 'item.play', { itemId: file.id, version: file.version, playing: true, position: 3.5 })).status, 200);
  const seen = (await snapshot(app, display)).items.find(i => i.id === file.id).playback;
  assert.equal(seen.playing, true);
  assert.equal(seen.position, 3.5);
  assert.ok(Math.abs(seen.at - Date.now()) < 5000);
  file = (await snapshot(app, admin)).items.find(i => i.id === file.id);
  assert.equal((await command(app, admin, 'item.play', { itemId: file.id, version: file.version, playing: false, position: 7 })).status, 200);
  assert.equal((await snapshot(app, owner)).items.find(i => i.id === file.id).playback.playing, false);
  const pdf = Buffer.from('%PDF-1.4\n%%EOF\n');
  await upload(app, owner, 'doc.pdf', pdf);
  const doc = (await snapshot(app, admin)).items.find(i => i.title === 'doc.pdf');
  assert.equal((await command(app, owner, 'item.play', { itemId: doc.id, version: doc.version, playing: true, position: 0 })).status, 400);
});
