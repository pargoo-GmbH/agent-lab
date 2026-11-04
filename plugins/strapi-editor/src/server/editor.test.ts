import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { harness, fixture } from './fixtures.ts';
import { publicError } from './errors.ts';

const png = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082',
  'hex',
);

test('two real HTTP MCP projects expose different schemas and route content and images to their own CMS', async (t) => {
  const a = await fixture(t, { stateful: true }),
    b = await fixture(t, { project: 'Bravo', token: 'fixture-admin-bravo' });
  const { editor, directory, credentials } = await harness(t);
  const reads = t.mock.method(credentials, 'get');
  const pa = await editor.profiles.save(
    { project: 'Alpha', name: 'Alpha Dev', environment: 'dev', cmsUrl: a.url },
    { mcp: a.token },
  );
  const pb = await editor.profiles.save(
    { project: 'Bravo', name: 'Bravo Dev', environment: 'dev', cmsUrl: b.url },
    { mcp: b.token },
  );
  const ca = await editor.contexts.open(),
    cb = await editor.contexts.open();
  await editor.contexts.select(ca.id, pa.id, pa.revision);
  await editor.contexts.select(cb.id, pb.id, pb.revision);
  const catalogue = await editor.discover(ca.id);
  assert.equal(reads.mock.callCount(), 1);
  assert.equal(catalogue.catalogue.server.name, 'Alpha');
  assert(catalogue.catalogue.tools.some((x) => x.name === 'update_alpha'));
  assert.equal(catalogue.catalogue.prompts[0].name, 'editorial');
  const schemaA = await editor.call({ contextId: ca.id, toolName: 'get_editor_schema' }),
    schemaB = await editor.call({ contextId: cb.id, toolName: 'get_editor_schema' });
  assert.deepEqual(schemaA.result.structuredContent.fields, ['title', 'html']);
  assert.deepEqual(schemaB.result.structuredContent.fields, ['headline', 'blocks']);
  assert.equal(reads.mock.callCount(), 3);
  assert.equal(a.sessions.created, 2);
  const id = randomUUID();
  const input = {
    contextId: ca.id,
    toolName: 'update_alpha',
    arguments: { title: 'New draft' },
    requestId: id,
  };
  const updated = await editor.call(input);
  assert.equal(reads.mock.callCount(), 4);
  assert.equal(a.sessions.created, 3);
  assert.equal(updated.result.structuredContent.project, 'Alpha');
  const again = await editor.call(input);
  assert.equal(again.reusedOperation, true);
  assert.equal(a.calls.filter((c) => c.name === 'update_alpha').length, 1);
  await assert.rejects(editor.call({ ...input, arguments: { title: 'Other draft' } }), {
    code: 'REQUEST_ID_CONFLICT',
  });
  const file = join(directory, 'image.png');
  await writeFile(file, png);
  const uploadId = randomUUID();
  const result = await editor.uploadRequest({
    contextId: cb.id,
    file,
    requestId: uploadId,
    alt: 'One pixel',
    folderId: 7,
  });
  assert.equal(result.profile.id, pb.id);
  assert.equal(result.result.asset.id, 1);
  assert.equal(a.uploads.length, 0);
  assert.equal(b.uploads.length, 1);
  assert.equal(b.uploads[0].fileInfo.folder, 7);
  await editor.uploadRequest({
    contextId: cb.id,
    file,
    requestId: uploadId,
    alt: 'One pixel',
    folderId: 7,
  });
  assert.equal(b.uploads.length, 1);
  const settings = await readFile(join(directory, 'profiles.json'), 'utf8');
  assert(!settings.includes(a.token));
  assert(!settings.includes(b.token));
  const stored = await editor.profiles.get(pa.id);
  await assert.rejects(
    editor.upstream.use(stored, async () => {
      throw new Error('Interrupted MCP task');
    }),
    { code: 'MCP_CONNECTION_FAILED' },
  );
  assert(a.sessions.created > 1);
  assert.equal(a.sessions.active.size, 0);
  assert.equal(a.sessions.terminated, a.sessions.created);
});

test('Production publication waits for exact confirmation and cannot follow an environment switch', async (t) => {
  let writes = 0;
  const upstream = {
    tool: async (_p, name) => ({ name, annotations: { readOnlyHint: false } }),
    call: async () => {
      writes++;

      return { content: [{ type: 'text', text: 'done' }] };
    },
  };
  const { editor } = await harness(t, { upstream });
  const prod = await editor.profiles.save(
    { project: 'A', name: 'A Prod', environment: 'production', cmsUrl: 'https://cms.example.com' },
    { mcp: 'test-prod' },
  );
  const dev = await editor.profiles.save(
    { project: 'A', name: 'A Dev', environment: 'dev', cmsUrl: 'https://dev.example.com' },
    { mcp: 'test-dev' },
  );
  const context = await editor.contexts.open();
  await editor.contexts.select(context.id, prod.id, prod.revision);
  const pending = await editor.call({
    contextId: context.id,
    toolName: 'publish_post',
    arguments: { id: 'article-1' },
    requestId: randomUUID(),
  });
  assert.equal(pending.pending, true);
  assert.equal(writes, 0);
  await editor.contexts.select(context.id, dev.id, dev.revision);
  await assert.rejects(editor.execute(context.id, pending.operationId), {
    code: 'TARGET_MISMATCH',
  });
  assert.equal(writes, 0);
  await editor.contexts.select(context.id, prod.id, prod.revision);
  const publish = await editor.call({
    contextId: context.id,
    toolName: 'unpublish_post',
    arguments: { id: 'article-1' },
    requestId: randomUUID(),
  });
  assert.equal(publish.pending, true);
  await editor.ui({
    action: 'execute_operation',
    contextId: context.id,
    uiNonce: context.uiNonce,
    operationId: publish.operationId,
  });
  assert.equal(writes, 1);
  await assert.rejects(editor.execute(context.id, publish.operationId), {
    code: 'OPERATION_ALREADY_STARTED',
  });
  assert.equal(writes, 1);
});

test('unknown write results are preserved and are never automatically replayed', async (t) => {
  let writes = 0;
  const upstream = {
    tool: async () => ({ annotations: { readOnlyHint: false } }),
    call: async () => {
      writes++;
      throw new Error('connection interrupted after write');
    },
  };
  const { editor } = await harness(t, { upstream });
  const p = await editor.profiles.save(
    { project: 'A', name: 'A Dev', environment: 'dev', cmsUrl: 'https://dev.example.com' },
    { mcp: 'test' },
  );
  const context = await editor.contexts.open();
  await editor.contexts.select(context.id, p.id, p.revision);
  const write = editor.store.write.bind(editor.store);

  for (const saveFails of [false, true]) {
    editor.store.write = async (name, value) => {
      if (saveFails && value.state === 'result_unknown') {
        throw new Error('Disk full');
      }

      return write(name, value);
    };
    const input = {
      contextId: context.id,
      toolName: 'update_post',
      arguments: { title: 'draft' },
      requestId: randomUUID(),
    };
    await assert.rejects(editor.call(input), (error) => {
      const warning = publicError(error);
      assert.equal(warning.code, 'OPERATION_RESULT_UNKNOWN');
      assert.equal(warning.resultUnknown, true);
      assert.equal(error.details.operationSaved, !saveFails);
      assert.match(warning.message, /Inspect the selected CMS/);

      return true;
    });
    const count = writes;
    const repeated = await editor.call(input);
    assert.equal(repeated.state, saveFails ? 'running' : 'result_unknown');
    assert.equal(writes, count);
  }

  assert.equal(writes, 2);
});

test('equivalent retries reuse legacy operations while changed values and array order conflict', async (t) => {
  let writes = 0;
  const { editor } = await harness(t, {
    upstream: {
      tool: async () => ({ annotations: { readOnlyHint: false } }),
      call: async () => {
        writes++;

        return { content: [{ type: 'text', text: 'saved' }] };
      },
    },
  });
  const profile = await editor.profiles.save(
    { project: 'A', name: 'A Dev', environment: 'dev', cmsUrl: 'https://dev.example.com' },
    { mcp: 'test' },
  );
  const context = await editor.contexts.open();
  await editor.contexts.select(context.id, profile.id, profile.revision);
  const input = {
    contextId: context.id,
    toolName: 'update_post',
    arguments: { title: 'Draft', locale: 'en', blocks: [{ title: 'First', locale: 'en' }, 'last'] },
    requestId: randomUUID(),
  };
  await editor.call(input);
  const file = `operation-${input.requestId}.json`;
  const operation = await editor.store.read(file, null);
  operation.digest = createHash('sha256')
    .update(JSON.stringify([profile.id, profile.revision, operation.input]))
    .digest('hex');
  await editor.store.write(file, operation);
  const argumentsReordered = {
    blocks: [{ locale: 'en', title: 'First' }, 'last'],
    locale: 'en',
    title: 'Draft',
  };
  const repeated = await editor.call({ ...input, arguments: argumentsReordered });
  assert.equal(repeated.reusedOperation, true);
  assert.equal(repeated.result.content[0].text, 'saved');

  for (const args of [
    { ...argumentsReordered, title: 'Different' },
    { ...argumentsReordered, blocks: [...argumentsReordered.blocks].reverse() },
  ]) {
    await assert.rejects(editor.call({ ...input, arguments: args }), {
      code: 'REQUEST_ID_CONFLICT',
    });
  }

  assert.equal(writes, 1);
});

test('missing context blocks content calls before any upstream request', async (t) => {
  let calls = 0;
  const { editor } = await harness(t, {
    upstream: {
      tool: async () => {
        calls++;
      },
    },
  });
  const context = await editor.contexts.open();
  await assert.rejects(editor.call({ contextId: context.id, toolName: 'update_post' }), {
    code: 'CONFIRM_ENVIRONMENT',
  });
  assert.equal(calls, 0);
});

test('an upstream tool error is recorded without reporting a successful change or replaying it', async (t) => {
  let writes = 0;
  const upstream = {
    tool: async () => ({ annotations: { readOnlyHint: false } }),
    call: async () => {
      writes++;

      return { isError: true, content: [{ type: 'text', text: 'Validation failed' }] };
    },
  };
  const { editor } = await harness(t, { upstream });
  const p = await editor.profiles.save(
    { project: 'A', name: 'A Dev', environment: 'dev', cmsUrl: 'https://dev.example.com' },
    { mcp: 'test' },
  );
  const context = await editor.contexts.open();
  await editor.contexts.select(context.id, p.id, p.revision);
  const input = {
    contextId: context.id,
    toolName: 'update_post',
    arguments: { title: 'draft' },
    requestId: randomUUID(),
  };
  const result = await editor.call(input);
  assert.equal(result.ok, false);
  assert.equal(result.result.isError, true);
  const repeated = await editor.call(input);
  assert.equal(repeated.ok, false);
  assert.equal(writes, 1);
});

test('a confirmed successful change is returned even if saving its final local record fails', async (t) => {
  const upstream = {
    tool: async () => ({ annotations: { readOnlyHint: false } }),
    call: async () => ({ content: [{ type: 'text', text: 'saved' }] }),
  };
  const { editor } = await harness(t, { upstream });
  const p = await editor.profiles.save(
    { project: 'A', name: 'A Dev', environment: 'dev', cmsUrl: 'https://dev.example.com' },
    { mcp: 'test' },
  );
  const context = await editor.contexts.open();
  await editor.contexts.select(context.id, p.id, p.revision);
  const write = editor.store.write.bind(editor.store);
  editor.store.write = async (name, value) => {
    if (name.startsWith('operation-') && value.state === 'complete') {
      throw new Error('disk full');
    }

    return write(name, value);
  };
  const result = await editor.call({
    contextId: context.id,
    toolName: 'update_post',
    arguments: { title: 'draft' },
    requestId: randomUUID(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.operationSaved, false);
  assert.equal(result.result.content[0].text, 'saved');
});

test('switching to Production while a Dev publication tool is being inspected cannot bypass approval', async (t) => {
  let resolveMetadata;
  let metadataStarted;
  let writes = 0;
  const started = new Promise((resolve) => (metadataStarted = resolve));
  const upstream = {
    tool: async () => {
      metadataStarted();

      return new Promise((resolve) => (resolveMetadata = resolve));
    },
    call: async () => {
      writes++;

      return { content: [] };
    },
  };
  const { editor } = await harness(t, { upstream });
  const dev = await editor.profiles.save(
    { project: 'A', name: 'A Dev', environment: 'dev', cmsUrl: 'https://dev.example.com' },
    { mcp: 'dev-test' },
  );
  const prod = await editor.profiles.save(
    { project: 'A', name: 'A Prod', environment: 'production', cmsUrl: 'https://prod.example.com' },
    { mcp: 'prod-test' },
  );
  const context = await editor.contexts.open();
  await editor.contexts.select(context.id, dev.id, dev.revision);
  const call = editor.call({
    contextId: context.id,
    toolName: 'publish_post',
    arguments: { id: 'article-1' },
    requestId: randomUUID(),
  });
  await started;
  await editor.contexts.select(context.id, prod.id, prod.revision);
  resolveMetadata({ annotations: { readOnlyHint: false } });
  await assert.rejects(call, { code: 'TARGET_MISMATCH' });
  assert.equal(writes, 0);
});

test('only publish and unpublish tools require panel approval, and only in Production', async (t) => {
  const calls = [];
  const metadata = {
    publishArticle: { readOnlyHint: false },
    cmsUnpublishArticle: { readOnlyHint: false },
    CMSPublishArticle: { readOnlyHint: false },
    unpublish_article: { readOnlyHint: false },
    'cms.publish': { readOnlyHint: true },
    'cms-unpublish': { readOnlyHint: false },
    deleteDocument: { readOnlyHint: false },
    CMSDeleteDocument: { readOnlyHint: true },
    remove_image: { readOnlyHint: false },
    destroyEntry: { readOnlyHint: false },
    archiveEntry: { readOnlyHint: false, destructiveHint: true },
    getEntry: { readOnlyHint: true, destructiveHint: true },
    createArticle: {},
    updateDraft: { readOnlyHint: false, destructiveHint: false },
    getPublishedArticles: { readOnlyHint: true },
    getUnpublishedArticles: { readOnlyHint: true },
  };
  const upstream = {
    tool: async (_p, name) => ({ name, annotations: metadata[name] }),
    call: async (_p, name) => {
      calls.push(name);

      return { content: [] };
    },
  };
  const { editor } = await harness(t, { upstream });
  const publicationNames = [
    'publishArticle',
    'cmsUnpublishArticle',
    'CMSPublishArticle',
    'unpublish_article',
    'cms.publish',
    'cms-unpublish',
  ];
  const otherWrites = [
    'deleteDocument',
    'CMSDeleteDocument',
    'remove_image',
    'destroyEntry',
    'archiveEntry',
    'getEntry',
    'createArticle',
    'updateDraft',
  ];

  for (const environment of ['dev', 'production']) {
    const profile = await editor.profiles.save(
      {
        project: 'A',
        name: environment,
        environment,
        cmsUrl: `https://${environment}.example.com`,
      },
      { mcp: 'fixture' },
    );
    const context = await editor.contexts.open();
    await editor.contexts.select(context.id, profile.id, profile.revision);

    for (const toolName of [...publicationNames, ...otherWrites]) {
      const request = {
        contextId: context.id,
        toolName,
        arguments: { id: 'article-1' },
        requestId: randomUUID(),
      };
      const before = calls.length;
      const result = await editor.call(request);

      if (environment === 'production' && publicationNames.includes(toolName)) {
        assert.equal(result.pending, true, toolName);
        assert.equal(calls.length, before);
        assert.deepEqual(
          (await editor.state(context.id)).pendingOperations.map((p) => p.operationId),
          [result.operationId],
        );
        await editor.ui({
          action: 'execute_operation',
          contextId: context.id,
          uiNonce: context.uiNonce,
          operationId: result.operationId,
        });
      } else {
        assert.equal(result.ok, true, toolName);
        assert.equal(result.pending, undefined, toolName);
      }

      assert.equal(calls.length, before + 1, toolName);
      assert.equal(calls.at(-1), toolName);
      assert.equal((await editor.call(request)).reusedOperation, true, toolName);
      assert.equal(calls.length, before + 1, toolName);
      assert.deepEqual((await editor.state(context.id)).pendingOperations, []);
    }

    for (const toolName of ['getPublishedArticles', 'getUnpublishedArticles']) {
      await editor.call({ contextId: context.id, toolName, arguments: {} });
      assert.equal(calls.at(-1), toolName);
    }
  }
});

test('image uploads run without panel approval in Dev and Production and retain replay protection', async (t) => {
  const uploads = [];
  const { editor } = await harness(t);
  editor.upload = async (input, options) => {
    uploads.push({ input, options });

    return { asset: { id: uploads.length } };
  };

  for (const environment of ['dev', 'production']) {
    const profile = await editor.profiles.save(
      {
        project: 'A',
        name: environment,
        environment,
        cmsUrl: `https://${environment}.example.com`,
      },
      { mcp: 'fixture' },
    );
    const context = await editor.contexts.open();
    await editor.contexts.select(context.id, profile.id, profile.revision);
    const request = {
      contextId: context.id,
      file: '/fixture/original.png',
      requestId: randomUUID(),
    };
    const before = uploads.length;
    const result = await editor.uploadRequest(request);
    assert.equal(result.ok, true);
    assert.equal(result.pending, undefined);
    assert.equal(uploads.length, before + 1);
    assert.equal(uploads.at(-1).options.cmsUrl, profile.cmsUrl);
    assert.deepEqual((await editor.state(context.id)).pendingOperations, []);
    assert.equal((await editor.uploadRequest(request)).reusedOperation, true);
    assert.equal(uploads.length, before + 1);
  }
});
