import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createServer } from './index.ts';
import { harness } from './fixtures.ts';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { readRegistration } from '../../scripts/check.ts';
import { EditorError } from './errors.ts';

test('concurrent MCP responses redact their own tokens and release them after success or failure', async (t) => {
  const { editor, credentials } = await harness(t);
  const profile = await editor.profiles.save(
    { project: 'A', name: 'Dev', environment: 'dev', cmsUrl: 'https://cms.example.com' },
    { mcp: 'fixture-private-token' },
  );
  const context = await editor.contexts.open();
  await editor.contexts.select(context.id, profile.id, profile.revision);
  const stored = await editor.profiles.get(profile.id);
  const key = stored.mcpCredential;
  const token = credentials.values.get(key);
  const firstStarted = Promise.withResolvers();
  const secondStarted = Promise.withResolvers();
  const releaseSecond = Promise.withResolvers();
  let count = 0;
  editor.upstream.discover = async () => {
    const value = await credentials.get(key);
    const call = ++count;

    if (call === 1) {
      firstStarted.resolve();
      await secondStarted.promise;
    } else if (call === 2) {
      secondStarted.resolve();
      await releaseSecond.promise;
    } else {
      throw new EditorError('FIXTURE_ERROR', `Failed with token ${value}`);
    }

    return { instructions: value };
  };
  const server = createServer(editor);
  const client = new Client({ name: 'redaction-test', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => {
    releaseSecond.resolve();
    await client.close();
    await server.close();
  });
  const discover = () =>
    client.callTool({
      name: 'strapi_discover',
      arguments: { contextId: context.id },
    });
  const first = discover();
  await firstStarted.promise;
  const second = discover();
  const result = await first;
  assert(!JSON.stringify(result).includes(token));
  assert.equal(result.structuredContent.catalogue.instructions, '[redacted]');
  assert.equal(credentials.redact(token), token);
  releaseSecond.resolve();
  assert(!JSON.stringify(await second).includes(token));
  const failure = await discover();
  assert.equal(failure.structuredContent.code, 'FIXTURE_ERROR');
  assert.equal(failure.structuredContent.message, 'Failed with token [redacted]');
  assert(!JSON.stringify(failure).includes(token));
  assert.equal(credentials.redact(token), token);
  assert.equal(count, 3);
});

test('MCP protocol keeps interface capability outside model content and rejects forged confirmation', async (t) => {
  const { editor } = await harness(t);
  const server = createServer(editor);
  const client = new Client({ name: 'test-host', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => {
    await client.close();
    await server.close();
  });
  const tools = (await client.listTools()).tools;
  assert.deepEqual(tools.find((tool) => tool.name === 'strapi_editor_ui')._meta.ui.visibility, [
    'app',
  ]);

  for (const name of [
    'strapi_call',
    'strapi_upload_image',
    'strapi_editor_ui',
    'strapi_choose_image',
  ]) {
    assert.equal(tools.find((tool) => tool.name === name)._meta?.ui?.resourceUri, undefined);
  }

  const opened = await client.callTool({ name: 'strapi_editor_open', arguments: {} });
  const nonce = opened._meta['strapiEditor/uiNonce'];
  assert(nonce);
  assert(!JSON.stringify(opened.structuredContent).includes(nonce));
  assert(!JSON.stringify(opened.content).includes(nonce));
  const forbidden = await client.callTool({
    name: 'strapi_editor_ui',
    arguments: {
      action: 'select_profile',
      contextId: opened.structuredContent.contextId,
      profileId: 'invented',
    },
  });
  assert.equal(forbidden.isError, true);
  assert.equal(forbidden.structuredContent.code, 'USER_INTERFACE_REQUIRED');
  const badArgs = await client.callTool({
    name: 'strapi_call',
    arguments: { contextId: 'not-a-context' },
  });
  assert.equal(badArgs.isError, true);
});

test('packaged stdio server starts using its bundled runtime with no system Node in PATH', async (t) => {
  const root = resolve(process.env.STRAPI_EDITOR_PACKAGE_DIR ?? 'dist');
  const runtime = resolve(root, 'runtime/node');
  await access(runtime);
  const { manifest, server } = await readRegistration(root);
  const expand = (value) => value.replaceAll('${PLUGIN_ROOT}', root);
  const { directory } = await harness(t);
  const transport = new StdioClientTransport({
    command: expand(server.command),
    args: server.args.map(expand),
    cwd: expand(server.cwd),
    env: { PATH: '/usr/bin:/bin', STRAPI_EDITOR_DATA_DIR: directory },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk) => (stderr += chunk));
  const client = new Client({ name: 'clean-path-test', version: '1.0.0' });
  await client.connect(transport);
  t.after(() => client.close());
  assert.equal(client.getServerVersion().version, manifest.version);
  const catalogue = await client.listTools();
  assert.equal(catalogue.tools.length, 10);
  assert(catalogue.tools.some((tool) => tool.name === 'strapi_discover'));
  const opened = await client.callTool({ name: 'strapi_editor_open', arguments: {} });
  assert.equal(opened.structuredContent.profiles.length, 0);
  const reopened = await client.callTool({
    name: 'strapi_editor_open',
    arguments: { contextId: opened.structuredContent.contextId },
  });
  assert.equal(reopened.structuredContent.contextId, opened.structuredContent.contextId);
  const resource = await client.readResource({ uri: 'ui://strapi-editor/editor.html' });
  assert(resource.contents[0].text.includes('pargoo Strapi (Apple Silicon)'));
  assert(!resource.contents[0].text.includes('/* APP_SCRIPT */'));
  assert.equal(stderr, '');
  assert.deepEqual(resource.contents[0]._meta['openai/ui'].availableDisplayModes, [
    'inline',
    'fullscreen',
  ]);
  assert(!resource.contents[0].text.includes('id="upload-form"'));
});
