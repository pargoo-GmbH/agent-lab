import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Native } from './native.ts';
import { createServer } from './index.ts';
import { fixture, harness } from './fixtures.ts';

async function fakeHelper(t, token = 'fixture-keychain-secret') {
  const directory = await mkdtemp(join(tmpdir(), 'strapi-keychain-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const helper = join(directory, 'helper.mjs');
  const mode = join(directory, 'mode');
  const calls = join(directory, 'calls');
  await writeFile(mode, 'ok');
  await writeFile(calls, '');
  await writeFile(
    helper,
    `#!${process.execPath}
import { appendFile, readFile } from 'node:fs/promises';
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const { action } = JSON.parse(Buffer.concat(chunks).toString());
await appendFile(${JSON.stringify(calls)}, action + '\\n');
const mode = await readFile(${JSON.stringify(mode)}, 'utf8');
const result = action === 'chooseFile' ? { ok: false, code: 'CANCELLED' }
  : mode === 'deny' ? { ok: false, code: 'KEYCHAIN_ACCESS_DENIED' }
  : mode === 'fail' ? { ok: false, code: 'NATIVE_HELPER_ERROR' }
  : { ok: true, ...(action === 'get' ? { value: ${JSON.stringify(token)} } : {}) };
console.log(JSON.stringify(result));
process.exitCode = result.ok || result.code === 'CANCELLED' ? 0 : 1;
`,
    { mode: 0o700 },
  );

  return {
    native: new Native(helper),
    mode,
    calls: async () => (await readFile(calls, 'utf8')).trim().split('\n').filter(Boolean),
  };
}

test('a Keychain denial stops queued and later reads until an explicit retry', async (t) => {
  const { native, mode, calls } = await fakeHelper(t);
  const key = `${randomUUID()}:${randomUUID()}`;
  await writeFile(mode, 'deny');
  const results = await Promise.allSettled([native.get(key), native.get(key), native.get(key)]);

  for (const result of results) {
    assert.equal(result.status, 'rejected');
    assert.equal(result.reason.code, 'KEYCHAIN_ACCESS_DENIED');
  }

  assert.deepEqual(await calls(), ['get']);
  assert.equal(native.accessBlocked, true);
  await writeFile(mode, 'ok');
  await assert.rejects(native.get(key), { code: 'KEYCHAIN_ACCESS_DENIED' });
  assert.deepEqual(await native.chooseFile(), { cancelled: true });
  assert.deepEqual(await calls(), ['get', 'chooseFile']);
  native.retryAccess();
  assert.equal(await native.get(key), 'fixture-keychain-secret');
  assert.equal(await native.get(key), 'fixture-keychain-secret');
  assert.deepEqual(await calls(), ['get', 'chooseFile', 'get', 'get']);
  await writeFile(mode, 'fail');
  await assert.rejects(native.get(key), { code: 'KEYCHAIN_UNAVAILABLE' });
  assert.equal(native.accessBlocked, false);
});

test('a cancelled upload stays pending and only an authorised panel retry permits it to run', async (t) => {
  const cms = await fixture(t);
  const { native, mode, calls } = await fakeHelper(t, cms.token);
  const { editor, directory } = await harness(t, { credentials: native });
  const profile = await editor.profiles.save(
    { project: 'A', name: 'Dev', environment: 'dev', cmsUrl: cms.url },
    { mcp: cms.token },
  );
  const context = await editor.contexts.open();
  await editor.contexts.select(context.id, profile.id, profile.revision);
  const file = join(directory, 'image.png');
  await writeFile(
    file,
    Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082',
      'hex',
    ),
  );
  const server = createServer(editor);
  const client = new Client({ name: 'keychain-test', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => {
    await client.close();
    await server.close();
  });
  const requestId = randomUUID();
  const upload = () =>
    client.callTool({
      name: 'strapi_upload_image',
      arguments: { contextId: context.id, requestId, file },
    });
  await writeFile(mode, 'deny');
  const denied = await upload();
  assert.equal(denied.structuredContent.code, 'KEYCHAIN_ACCESS_DENIED');
  assert.equal(denied.structuredContent.resultUnknown, undefined);
  assert.equal((await editor.status(context.id, requestId)).state, 'awaiting_confirmation');
  assert.equal((await editor.state(context.id)).credentialAccessBlocked, true);
  assert.equal(cms.uploads.length, 0);
  const beforeRetry = await calls();
  await writeFile(mode, 'ok');
  assert.equal((await upload()).structuredContent.code, 'KEYCHAIN_ACCESS_DENIED');
  const action = { action: 'retry_credential_access', contextId: context.id };
  const forged = await client.callTool({ name: 'strapi_editor_ui', arguments: action });
  assert.equal(forged.structuredContent.code, 'USER_INTERFACE_REQUIRED');
  assert.equal(native.accessBlocked, true);
  const resumed = await client.callTool({
    name: 'strapi_editor_ui',
    arguments: { ...action, uiNonce: context.uiNonce },
  });
  assert.equal(resumed.structuredContent.credentialAccessBlocked, false);
  assert.deepEqual(await calls(), beforeRetry);
  assert.equal(cms.uploads.length, 0);
  const result = await upload();
  assert.equal(result.structuredContent.result.asset.id, 1);
  assert.equal(cms.uploads.length, 1);
  const status = await editor.status(context.id, requestId);
  assert.equal(status.state, 'complete');
  assert.equal(status.error, undefined);
});
