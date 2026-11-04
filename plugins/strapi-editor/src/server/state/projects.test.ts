import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { harness } from '../fixtures.ts';
import { createEditor } from '../index.ts';

const fields = {
  project: 'Alpha',
  name: 'Main website',
  environment: 'dev',
  cmsUrl: 'https://alpha.example.com',
};

test('legacy projects have stable identities without rewriting profiles, credentials or confirmed contexts', async (t) => {
  const { editor, directory, credentials } = await harness(t);
  const profile = await editor.profiles.save(fields, { mcp: 'legacy-fixture-token' });
  const context = await editor.contexts.open();
  await editor.contexts.select(context.id, profile.id, profile.revision);
  const beforeProfiles = await readFile(join(directory, 'profiles.json'));
  const beforeContext = await readFile(join(directory, `context-${context.id}.json`));
  const beforeCredentials = [...credentials.values];
  const first = await editor.state(context.id);
  assert.equal(first.projects.length, 1);
  assert.equal(first.projects[0].name, 'Alpha');
  assert.equal(first.selected.id, profile.id);
  await editor.projects.create({ name: 'Empty project' });
  const reloaded = createEditor({ directory, credentials, native: {} });
  assert.equal(
    (await reloaded.projects.list()).find((p) => p.name === 'Alpha').id,
    first.projects[0].id,
  );
  assert.equal((await reloaded.contexts.require(context.id)).profile.revision, profile.revision);
  assert.deepEqual(await readFile(join(directory, 'profiles.json')), beforeProfiles);
  assert.deepEqual(await readFile(join(directory, `context-${context.id}.json`)), beforeContext);
  assert.deepEqual([...credentials.values], beforeCredentials);
});

test('empty projects persist independently and concurrent creation cannot lose projects', async (t) => {
  const { editor, directory, credentials } = await harness(t);
  const created = await Promise.all(
    ['Alpha', 'Bravo', 'Charlie'].map((name) => editor.projects.create({ name })),
  );
  const reloaded = createEditor({ directory, credentials, native: {} });
  assert.deepEqual(
    (await reloaded.projects.list()).map((p) => p.id).sort(),
    created.map((p) => p.id).sort(),
  );
  assert.deepEqual(await editor.profiles.list(), []);
  assert.equal(credentials.values.size, 0);
  assert.equal((await stat(join(directory, 'projects.json'))).mode & 0o777, 0o600);
  await assert.rejects(editor.projects.create({ name: ' alpha ' }), { code: 'PROJECT_DUPLICATE' });

  for (const name of ['', '   ', 'x'.repeat(101), 'Alpha\nBeta']) {
    await assert.rejects(editor.projects.create({ name }), { code: 'PROJECT_INVALID' });
  }
});

test('project creation and project-bound environment saving require the private interface capability', async (t) => {
  const { editor, credentials } = await harness(t);
  const context = await editor.contexts.open();
  await assert.rejects(
    editor.ui({ action: 'create_project', contextId: context.id, project: { name: 'Alpha' } }),
    { code: 'USER_INTERFACE_REQUIRED' },
  );
  assert.deepEqual(await editor.projects.list(), []);
  const state = await editor.ui({
    action: 'create_project',
    contextId: context.id,
    uiNonce: context.uiNonce,
    project: { name: 'Alpha' },
  });
  assert.equal(state.createdProject.name, 'Alpha');
  assert.equal(state.selected, null);
  const input = {
    action: 'save_profile',
    contextId: context.id,
    uiNonce: context.uiNonce,
    projectId: state.createdProject.id,
    profile: fields,
    tokens: { mcp: 'fixture' },
  };
  await assert.rejects(editor.ui({ ...input, projectId: randomUUID() }), {
    code: 'PROJECT_NOT_FOUND',
  });
  await assert.rejects(editor.ui({ ...input, profile: { ...fields, project: 'Other' } }), {
    code: 'PROJECT_CHANGED',
  });
  assert.equal(credentials.values.size, 0);
  const saved = await editor.ui(input);
  assert.equal(saved.savedProfile.project, 'Alpha');
  assert.equal(saved.selected, null);
});

test('removing the last legacy environment retains its project and never switches another chat', async (t) => {
  const { editor } = await harness(t);
  const a = await editor.profiles.save(fields, { mcp: 'a-fixture' });
  const b = await editor.profiles.save(
    { ...fields, project: 'Bravo', cmsUrl: 'https://bravo.example.com' },
    { mcp: 'b-fixture' },
  );
  const one = await editor.contexts.open(),
    two = await editor.contexts.open();
  await editor.contexts.select(one.id, a.id, a.revision);
  await editor.contexts.select(two.id, b.id, b.revision);
  const project = (await editor.projects.list()).find((p) => p.name === 'Alpha');
  const removed = await editor.ui({
    action: 'remove_profile',
    contextId: one.id,
    uiNonce: one.uiNonce,
    profileId: a.id,
    revision: a.revision,
  });
  assert.equal(removed.projects.find((p) => p.name === 'Alpha').id, project.id);
  assert.equal(removed.selected, null);
  assert.equal((await editor.state(two.id)).selected.id, b.id);
});

test('environment names are unique within a project while multiple environments can share a type', async (t) => {
  const { editor } = await harness(t);
  await editor.profiles.save(fields, { mcp: 'one' });
  await editor.profiles.save(
    { ...fields, name: 'Editor sandbox', cmsUrl: 'https://sandbox.example.com' },
    { mcp: 'two' },
  );
  await editor.profiles.save(
    { ...fields, project: 'Bravo', cmsUrl: 'https://bravo.example.com' },
    { mcp: 'three' },
  );
  await assert.rejects(editor.profiles.save({ ...fields, name: 'MAIN WEBSITE' }, { mcp: 'four' }), {
    code: 'PROFILE_DUPLICATE',
  });
  assert.equal(
    (await editor.profiles.list()).filter((p) => p.project === 'Alpha' && p.environment === 'dev')
      .length,
    2,
  );
});

test('unsupported project storage is preserved rather than replaced during creation', async (t) => {
  const { editor, directory } = await harness(t);
  await editor.store.write('projects.json', { version: 99, projects: [] });
  const before = await readFile(join(directory, 'projects.json'));
  await assert.rejects(editor.projects.create({ name: 'Alpha' }), { code: 'SETTINGS_VERSION' });
  assert.deepEqual(await readFile(join(directory, 'projects.json')), before);
});

test('project removal requires the private interface and never removes environments or another chat’s selection', async (t) => {
  const { editor, directory, credentials } = await harness(t);
  const profile = await editor.profiles.save(fields, { mcp: 'fixture' });
  const active = await editor.contexts.open(),
    other = await editor.contexts.open();
  await editor.contexts.select(active.id, profile.id, profile.revision);
  const occupied = (await editor.projects.list())[0];
  const empty = await editor.projects.create({ name: 'Empty project' });
  const beforeProfiles = await readFile(join(directory, 'profiles.json'));
  const beforeContext = await readFile(join(directory, `context-${active.id}.json`));
  const beforeCredentials = [...credentials.values];
  const input = { action: 'remove_project', contextId: other.id, projectId: empty.id };
  await assert.rejects(editor.ui(input), { code: 'USER_INTERFACE_REQUIRED' });
  await assert.rejects(editor.ui({ ...input, uiNonce: other.uiNonce, projectId: occupied.id }), {
    code: 'PROJECT_NOT_EMPTY',
  });
  const removed = await editor.ui({ ...input, uiNonce: other.uiNonce });
  assert.deepEqual(removed.projects, [occupied]);
  assert.equal(removed.selected, null);
  assert.equal((await editor.state(active.id)).selected.id, profile.id);
  assert.deepEqual(await readFile(join(directory, 'profiles.json')), beforeProfiles);
  assert.deepEqual(await readFile(join(directory, `context-${active.id}.json`)), beforeContext);
  assert.deepEqual([...credentials.values], beforeCredentials);
  const reloaded = createEditor({ directory, credentials, native: {} });
  assert.deepEqual(await reloaded.projects.list(), [occupied]);
});

test('an environment form cannot recreate a removed project or attach to a new project with the same name', async (t) => {
  const { editor, credentials } = await harness(t);
  const project = await editor.projects.create({ name: 'Alpha' });
  await editor.projects.remove(project.id);
  const replacement = await editor.projects.create({ name: 'Alpha' });
  assert.notEqual(project.id, replacement.id);
  await assert.rejects(editor.profiles.save(fields, { mcp: 'fixture' }, project.id), {
    code: 'PROJECT_NOT_FOUND',
  });
  assert.equal(credentials.values.size, 0);
  assert.deepEqual(await editor.profiles.list(), []);
});

test('project removal and environment saving share a lock across windows', async (t) => {
  const { editor, directory, credentials } = await harness(t);
  const project = await editor.projects.create({ name: 'Alpha' });
  const anotherWindow = createEditor({ directory, credentials, native: {} });
  const [removed, saved] = await Promise.allSettled([
    editor.projects.remove(project.id),
    anotherWindow.profiles.save(fields, { mcp: 'fixture' }, project.id),
  ]);
  assert.equal([removed, saved].filter((result) => result.status === 'fulfilled').length, 1);

  if (removed.status === 'fulfilled') {
    assert.equal(saved.reason.code, 'PROJECT_NOT_FOUND');
    assert.deepEqual(await editor.projects.list(), []);
    assert.deepEqual(await editor.profiles.list(), []);
    assert.equal(credentials.values.size, 0);
  } else {
    assert.equal(removed.reason.code, 'PROJECT_NOT_EMPTY');
    assert.deepEqual(await editor.projects.list(), [project]);
    assert.equal((await editor.profiles.list()).length, 1);
  }
});
