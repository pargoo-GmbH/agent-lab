import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { harness } from '../fixtures.ts';
import { normalizeProfile } from './profiles.ts';
import { createEditor } from '../index.ts';

const fields = {
  project: 'Example Project',
  name: 'Example Project Dev',
  environment: 'dev',
  cmsUrl: 'https://cms-dev.example.com/',
};

test('profiles keep tokens in credential storage, preserve IDs and require fresh credentials for a new target', async (t) => {
  const { editor, directory, credentials } = await harness(t);
  const profile = await editor.profiles.save(fields, { mcp: 'test-secret-mcp', upload: 'unused' });
  assert.equal(profile.cmsUrl, 'https://cms-dev.example.com');
  assert.equal(profile.mcpUrl, profile.cmsUrl + '/mcp');
  assert.equal(profile.mcpCredential, undefined);
  assert.equal(profile.uploadCredential, undefined);
  assert.equal(credentials.values.size, 1);
  const json = await readFile(join(directory, 'profiles.json'), 'utf8');
  assert(!json.includes('test-secret-mcp'));
  assert.equal((await stat(join(directory, 'profiles.json'))).mode & 0o777, 0o600);
  const renamed = await editor.profiles.save({ ...profile, name: 'Renamed' }, {});
  assert.equal(renamed.id, profile.id);
  assert.notEqual(renamed.revision, profile.revision);
  await assert.rejects(
    editor.profiles.save({ ...renamed, cmsUrl: 'https://other.example.com' }, {}),
    { code: 'CREDENTIAL_REQUIRED' },
  );
  const changed = await editor.profiles.save(
    { ...renamed, cmsUrl: 'https://other.example.com' },
    { mcp: 'new-target-secret' },
  );
  assert.equal(changed.id, profile.id);
  assert.equal(credentials.values.size, 1);
});

test('separate upload tokens survive editing and stale windows cannot overwrite profiles', async (t) => {
  const { editor, credentials } = await harness(t);
  const profile = await editor.profiles.save(
    { ...fields, separateUploadToken: true },
    { mcp: 'test-mcp', upload: 'test-upload' },
  );
  assert.equal(profile.separateUploadToken, true);
  assert.equal(credentials.values.size, 2);
  const changed = await editor.profiles.save({ ...profile, name: 'New label' }, {});
  assert.equal(changed.separateUploadToken, true);
  assert.equal(credentials.values.size, 2);
  await assert.rejects(editor.profiles.save({ ...profile, name: 'Stale' }, {}), {
    code: 'PROFILE_CHANGED',
  });
  await editor.profiles.remove(changed.id, changed.revision);
  assert.equal(credentials.values.size, 0);
  assert.deepEqual(await editor.profiles.list(), []);
});

test('profile URL validation requires explicit environment and blocks production HTTP and embedded credentials', () => {
  for (const patch of [
    { environment: 'staging' },
    { environment: 'production', cmsUrl: 'http://localhost:1234' },
    { cmsUrl: 'https://user:password@example.com' },
    { cmsUrl: 'https://example.com?token=secret' },
    { cmsUrl: 'https://example.com/admin' },
    { cmsUrl: 'http://external.example.com' },
  ]) {
    assert.throws(() => normalizeProfile({ ...fields, ...patch }), { code: 'PROFILE_INVALID' });
  }

  assert.equal(
    normalizeProfile({ ...fields, cmsUrl: 'https://example.com/cms/' }).mcpUrl,
    'https://example.com/cms/mcp',
  );
});

test('contexts are independent and profile changes invalidate confirmation', async (t) => {
  const { editor } = await harness(t);
  const a = await editor.profiles.save(fields, { mcp: 'a-token' });
  const b = await editor.profiles.save(
    {
      ...fields,
      name: 'Pargoo Prod',
      project: 'Pargoo',
      environment: 'production',
      cmsUrl: 'https://prod.example.com',
    },
    { mcp: 'b-token' },
  );
  const first = await editor.contexts.open(),
    second = await editor.contexts.open();
  await editor.contexts.select(first.id, a.id, a.revision);
  await editor.contexts.select(second.id, b.id, b.revision);
  assert.equal((await editor.contexts.require(first.id)).profile.id, a.id);
  assert.equal((await editor.contexts.require(second.id)).profile.id, b.id);
  await editor.contexts.select(second.id, a.id, a.revision);
  assert.equal((await editor.contexts.require(first.id)).profile.id, a.id);
  await editor.profiles.save({ ...a, name: 'Updated' }, {});
  await assert.rejects(editor.contexts.require(first.id), { code: 'CONFIRM_ENVIRONMENT' });
});

test('private interface capability is required for profile selection and credential input', async (t) => {
  const { editor } = await harness(t);
  const context = await editor.contexts.open();
  await assert.rejects(
    editor.ui({
      action: 'save_profile',
      contextId: context.id,
      profile: fields,
      tokens: { mcp: 'test' },
    }),
    { code: 'USER_INTERFACE_REQUIRED' },
  );
  const state = await editor.ui({
    action: 'save_profile',
    contextId: context.id,
    uiNonce: context.uiNonce,
    profile: fields,
    tokens: { mcp: 'test' },
  });
  assert.equal(state.profiles.length, 1);
  assert(!JSON.stringify(state).includes(context.uiNonce));
  await assert.rejects(
    editor.ui({
      action: 'select_profile',
      contextId: context.id,
      uiNonce: randomUUID(),
      profileId: state.profiles[0].id,
      revision: state.profiles[0].revision,
    }),
    { code: 'USER_INTERFACE_REQUIRED' },
  );
});

test('concurrent saves do not lose independent profiles', async (t) => {
  const { editor } = await harness(t);
  await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      editor.profiles.save({ ...fields, name: `Connection ${i}` }, { mcp: `test-${i}` }),
    ),
  );
  assert.equal((await editor.profiles.list()).length, 5);
});

test('failed credential removal remains durable and can be retried only through the private panel', async (t) => {
  const { editor, directory, credentials } = await harness(t);
  const profile = await editor.profiles.save(fields, { mcp: 'disposable-fixture' });
  const context = await editor.contexts.open();
  await editor.contexts.select(context.id, profile.id, profile.revision);
  const remove = credentials.delete.bind(credentials);
  credentials.delete = async () => {
    throw new Error('Simulated Keychain refusal');
  };
  const state = await editor.ui({
    action: 'remove_profile',
    contextId: context.id,
    uiNonce: context.uiNonce,
    profileId: profile.id,
    revision: profile.revision,
  });
  assert.equal(state.credentialCleanupPending, true);
  assert.equal(state.selected, null);
  assert.equal(state.profiles.length, 0);
  assert.equal(credentials.values.size, 1);
  const settings = await editor.profiles.cleanupSettings();
  assert.equal(settings.references.length, 1);
  assert.equal((await stat(join(directory, 'credential-cleanup.json'))).mode & 0o777, 0o600);
  assert(!JSON.stringify(state).includes(settings.references[0]));
  assert(
    !(await readFile(join(directory, 'credential-cleanup.json'), 'utf8')).includes(
      'disposable-fixture',
    ),
  );
  const reloaded = createEditor({ directory, credentials, native: {} });
  assert.equal((await reloaded.state(context.id)).credentialCleanupPending, true);
  await assert.rejects(reloaded.ui({ action: 'retry_credential_cleanup', contextId: context.id }), {
    code: 'USER_INTERFACE_REQUIRED',
  });
  credentials.delete = remove;
  const finished = await reloaded.ui({
    action: 'retry_credential_cleanup',
    contextId: context.id,
    uiNonce: context.uiNonce,
  });
  assert.equal(finished.credentialCleanupPending, false);
  assert.equal(credentials.values.size, 0);
  assert.deepEqual(await editor.profiles.list(), []);
});

test('failed cleanup after token replacement never loses old references or deletes the current credential', async (t) => {
  const { editor, directory, credentials } = await harness(t);
  const profile = await editor.profiles.save(fields, { mcp: 'old-fixture' });
  const remove = credentials.delete.bind(credentials);
  credentials.delete = async () => {
    throw new Error('Simulated Keychain refusal');
  };
  const changed = await editor.profiles.save(
    { ...profile, name: 'Updated' },
    { mcp: 'current-fixture' },
  );
  assert.equal(credentials.values.size, 2);
  assert.equal(await editor.profiles.hasPendingCleanup(), true);
  const current = await editor.profiles.get(changed.id);
  assert.equal(await credentials.get(current.mcpCredential), 'current-fixture');
  const reloaded = createEditor({ directory, credentials, native: {} });
  credentials.delete = remove;
  await reloaded.profiles.cleanup();
  assert.equal(credentials.values.size, 1);
  assert.equal(await credentials.get(current.mcpCredential), 'current-fixture');
  assert.equal(await editor.profiles.hasPendingCleanup(), false);
});

test('a failed save tracks provisional credentials for later cleanup without replacing the previous profile', async (t) => {
  const { editor, directory, credentials } = await harness(t);
  const profile = await editor.profiles.save(fields, { mcp: 'current-fixture' });
  const set = credentials.set.bind(credentials),
    remove = credentials.delete.bind(credentials);
  credentials.set = async (key, value) => {
    if (value === 'rejected-upload') {
      throw new Error('Simulated token save failure');
    }

    return set(key, value);
  };
  credentials.delete = async () => {
    throw new Error('Simulated cleanup failure');
  };
  await assert.rejects(
    editor.profiles.save(
      { ...profile, separateUploadToken: true },
      { mcp: 'uncommitted-fixture', upload: 'rejected-upload' },
    ),
    /Simulated token save failure/,
  );
  assert.equal((await editor.profiles.get(profile.id)).revision, profile.revision);
  assert.equal(await editor.profiles.hasPendingCleanup(), true);
  assert.equal(credentials.values.size, 2);
  const reloaded = createEditor({ directory, credentials, native: {} });
  credentials.delete = remove;
  await reloaded.profiles.cleanup();
  assert.equal(credentials.values.size, 1);
  assert.equal(
    await credentials.get((await reloaded.profiles.get(profile.id)).mcpCredential),
    'current-fixture',
  );
});

test('cleanup queue persistence failures are retryable and live credentials are always retained', async (t) => {
  const { editor, credentials } = await harness(t);
  const profile = await editor.profiles.save(fields, { mcp: 'old-fixture' });
  const write = editor.store.write.bind(editor.store);
  editor.store.write = async (name, value) => {
    if (name === 'credential-cleanup.json' && value.references.length === 0) {
      throw new Error('Simulated disk failure after cleanup');
    }

    return write(name, value);
  };
  const changed = await editor.profiles.save(
    { ...profile, name: 'Updated' },
    { mcp: 'current-fixture' },
  );
  assert.equal(await editor.profiles.hasPendingCleanup(), true);
  assert.equal(credentials.values.size, 1);
  editor.store.write = write;
  const settings = await editor.profiles.cleanupSettings();
  const current = await editor.profiles.get(changed.id);
  await write('credential-cleanup.json', {
    version: 1,
    references: [...settings.references, current.mcpCredential],
  });
  await editor.profiles.cleanup();
  assert.equal(await editor.profiles.hasPendingCleanup(), false);
  assert.equal(await credentials.get(current.mcpCredential), 'current-fixture');
});

test('unsupported cleanup records are preserved without deleting credentials', async (t) => {
  const { editor, directory, credentials } = await harness(t);
  await editor.profiles.save(fields, { mcp: 'fixture' });
  await editor.store.write('credential-cleanup.json', { version: 99, references: [] });
  const before = await readFile(join(directory, 'credential-cleanup.json'));
  await assert.rejects(editor.profiles.cleanup(), { code: 'SETTINGS_VERSION' });
  assert.equal(credentials.values.size, 1);
  assert.deepEqual(await readFile(join(directory, 'credential-cleanup.json')), before);
});
