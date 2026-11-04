import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { harness } from './fixtures.ts';
import { EditorError } from './errors.ts';

const fields = {
  project: 'Alpha',
  name: 'Alpha Dev',
  environment: 'dev',
  cmsUrl: 'https://alpha.example.com',
};
const tool = {
  name: 'publish_article',
  title: 'Publish article',
  annotations: { readOnlyHint: false },
};

test('panel state reflects the current selection and only its own valid pending approvals', async (t) => {
  const upstream = { tool: async () => tool, call: async () => ({ ok: true }) };
  const { editor } = await harness(t, { upstream });
  const a = await editor.profiles.save(
    { ...fields, name: 'Alpha Production', environment: 'production' },
    { mcp: 'fixture-a' },
  );
  const b = await editor.profiles.save(
    { ...fields, name: 'Bravo Dev', project: 'Bravo', cmsUrl: 'https://bravo.example.com' },
    { mcp: 'fixture-b' },
  );
  const first = await editor.contexts.open(),
    second = await editor.contexts.open();
  await editor.contexts.select(first.id, a.id, a.revision);
  await editor.contexts.select(second.id, a.id, a.revision);
  const request = {
    contextId: first.id,
    toolName: 'publish_article',
    arguments: { title: 'First chat' },
    requestId: randomUUID(),
  };
  const pending = await editor.call(request);
  await editor.call({
    ...request,
    contextId: second.id,
    requestId: randomUUID(),
    arguments: { title: 'Other chat' },
  });
  assert.deepEqual(
    (await editor.state(first.id)).pendingOperations.map((p) => p.operationId),
    [pending.operationId],
  );
  await editor.contexts.select(first.id, b.id, b.revision);
  const switched = await editor.state(first.id);
  assert.equal(switched.selected.id, b.id);
  assert.deepEqual(switched.pendingOperations, []);
  assert.equal((await editor.state(second.id)).selected.id, a.id);
  await editor.contexts.select(first.id, a.id, a.revision);
  await editor.ui({
    action: 'execute_operation',
    contextId: first.id,
    uiNonce: first.uiNonce,
    operationId: pending.operationId,
  });
  assert.deepEqual((await editor.state(first.id)).pendingOperations, []);
});

test('connection checks describe actual results and expire after editing a profile', async (t) => {
  let failed = false;
  const upstream = {
    check: async () => {
      if (failed) {
        throw new EditorError('ACCESS_DENIED', 'Access denied.');
      }

      return { ok: true, mcp: 'connected', message: 'MCP connected; upload untested.' };
    },
  };
  const { editor } = await harness(t, { upstream });
  const profile = await editor.profiles.save(fields, { mcp: 'fixture-a' });
  const context = await editor.contexts.open();
  assert.deepEqual((await editor.state(context.id)).checks, {});
  await editor.ui({
    action: 'check_profile',
    contextId: context.id,
    uiNonce: context.uiNonce,
    profileId: profile.id,
  });
  assert.equal((await editor.state(context.id)).checks[profile.id].status, 'connected');
  failed = true;
  await assert.rejects(
    editor.ui({
      action: 'check_profile',
      contextId: context.id,
      uiNonce: context.uiNonce,
      profileId: profile.id,
    }),
    { code: 'ACCESS_DENIED' },
  );
  assert.equal((await editor.state(context.id)).checks[profile.id].status, 'needs_attention');
  await editor.profiles.save({ ...profile, name: 'Renamed' }, {});
  assert.deepEqual((await editor.state(context.id)).checks, {});
});

test('agent image picker requires the confirmed chat context and preserves cancellation', async (t) => {
  let calls = 0;
  const { editor } = await harness(t, {
    native: {
      chooseFile: async () => {
        calls++;

        return { cancelled: true };
      },
    },
  });
  const profile = await editor.profiles.save(fields, { mcp: 'fixture-a' });
  const context = await editor.contexts.open();
  await assert.rejects(editor.chooseImage(context.id), { code: 'CONFIRM_ENVIRONMENT' });
  assert.equal(calls, 0);
  await editor.contexts.select(context.id, profile.id, profile.revision);
  assert.deepEqual(await editor.chooseImage(context.id), {
    cancelled: true,
    contextId: context.id,
  });
  assert.equal(calls, 1);
});
