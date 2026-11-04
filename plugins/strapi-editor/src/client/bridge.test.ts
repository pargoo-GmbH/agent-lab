import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { App } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server/index.ts';
import { harness } from '../server/fixtures.ts';

test(
  'publication reaches the agent when saving its record and refreshing the panel fail',
  { timeout: 5000 },
  async (t) => {
    let writes = 0;
    const { editor } = await harness(t, {
      upstream: {
        tool: async () => ({ annotations: { readOnlyHint: false } }),
        call: async () => {
          writes++;

          return {
            content: [{ type: 'text', text: 'published' }],
            structuredContent: { documentId: 'article-1', published: true },
          };
        },
      },
    });
    const profile = await editor.profiles.save(
      {
        project: 'A',
        name: 'Production',
        environment: 'production',
        cmsUrl: 'https://cms.example.com',
      },
      { mcp: 'fixture-admin' },
    );
    const context = await editor.contexts.open();
    await editor.contexts.select(context.id, profile.id, profile.revision);
    const pending = await editor.call({
      contextId: context.id,
      toolName: 'publish_post',
      arguments: { documentId: 'article-1' },
      requestId: randomUUID(),
    });
    const server = createServer(editor);
    const client = new Client({ name: 'publication-fixture', version: '1.0.0' });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const host = new AppBridge(
      null,
      { name: 'publication-fixture', version: '26.1102.00000' },
      { serverTools: {} },
      { hostContext: { displayMode: 'fullscreen' } },
    );
    const [appTransport, hostTransport] = InMemoryTransport.createLinkedPair();
    const messages = [],
      contexts = [];
    let hydrated;
    const ready = new Promise((resolve) => {
      hydrated = resolve;
    });
    host.oncalltool = (params) => client.callTool(params);
    host.onupdatemodelcontext = async (params) => {
      contexts.push(params.structuredContent);
      hydrated();

      return {};
    };
    host.onmessage = async (params) => {
      messages.push(params);

      return {};
    };
    let closeApp;
    const connect = App.prototype.connect;
    t.mock.method(App.prototype, 'connect', function () {
      closeApp = async () => {
        await this.onteardown?.({});
        await this.close();
      };

      return connect.call(this, appTransport);
    });
    t.mock.method(App.prototype, 'setupSizeChangedNotifications', () => () => {});
    const previousDocument = globalThis.document,
      previousWindow = globalThis.window;
    globalThis.document = {
      documentElement: { style: {}, dataset: {} },
      body: { dataset: {} },
      visibilityState: 'hidden',
      addEventListener() {},
      removeEventListener() {},
    };
    globalThis.window = { addEventListener() {}, removeEventListener() {} };
    t.after(async () => {
      await closeApp?.();
      await host.close();
      await client.close();
      await server.close();
      t.mock.restoreAll();
      globalThis.document = previousDocument;
      globalThis.window = previousWindow;
    });
    await host.connect(hostTransport);
    const bridge = await import('./bridge.ts');
    await bridge.start();
    await host.sendToolResult(
      await client.callTool({ name: 'strapi_editor_open', arguments: { contextId: context.id } }),
    );
    await ready;
    const write = editor.store.write.bind(editor.store);
    editor.store.write = async (name, value) => {
      if (value.state === 'complete') {
        throw new Error('Disk full');
      }

      return write(name, value);
    };
    const state = editor.state.bind(editor);
    editor.state = async (...args) => {
      if (writes) {
        throw new Error('Settings unavailable');
      }

      return state(...args);
    };
    await bridge.run(() => bridge.approveOperation(pending.operationId));
    assert.equal(writes, 1);
    assert.equal(messages.length, 1);
    const delivered = JSON.parse(messages[0].content[1].text);
    assert.equal(delivered.operationSaved, false);
    assert.equal(delivered.result.structuredContent.documentId, 'article-1');
    assert.equal(delivered.result.structuredContent.published, true);
    assert(delivered.message);
    assert.deepEqual(contexts.at(-1).strapiEditor.lastOperation, delivered);
    assert.equal(bridge.getSnapshot().error, true);
    const status = await client.callTool({
      name: 'strapi_operation_status',
      arguments: { contextId: context.id, operationId: pending.operationId },
    });
    assert.equal(status.structuredContent.state, 'running');
  },
);
