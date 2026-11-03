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
