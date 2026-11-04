import type { Fields, StoredProfile } from './types.ts';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Upstream } from './strapi/mcp-client.ts';
type Hooks = { after(callback: () => void | Promise<void>): unknown };
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Native } from './native.ts';
import { createEditor } from './index.ts';
import { requireValue } from './errors.ts';

type StubUpstream = {
  tool(profile: StoredProfile, name: string): Promise<Tool | undefined>;
  call: Upstream['call'];
};

export class MemoryCredentials extends Native {
  values: Map<string, string>;
  constructor() {
    super();
    this.values = new Map<string, string>();
  }

  async set(key: string, value: string) {
    this.values.set(key, value);
    this.remember(value);
  }

  async get(key: string) {
    if (!this.values.has(key)) {
      throw new Error('Missing test credential');
    }

    const value = this.values.get(key)!;
    this.remember(value);

    return value;
  }

  async delete(key: string) {
    this.values.delete(key);
  }
}

export async function harness(
  t: Hooks,
  options: Omit<NonNullable<Parameters<typeof createEditor>[0]>, 'upstream'> & {
    upstream?: Upstream | StubUpstream;
  } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), 'strapi-editor-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const credentials = new MemoryCredentials();
  const upstream = options.upstream;
  let adapted: Upstream | undefined;

  if (upstream && !('withTool' in upstream)) {
    const withTool: Upstream['withTool'] = async (profile, name, args, task) => {
      const tool = await upstream.tool(profile, name);
      requireValue(tool, 'TOOL_NOT_AVAILABLE', 'The test tool is unavailable.');

      return task(tool, () => upstream.call(profile, name, args));
    };
    adapted = Object.assign(new Upstream(credentials), upstream, { withTool });
  } else {
    adapted = upstream;
  }

  const editor = createEditor({
    directory,
    credentials,
    native: { chooseFile: async () => ({ cancelled: true }) },
    ...options,
    upstream: adapted,
  });

  return { editor, directory, credentials };
}

export async function fixture(
  t: Hooks,
  { project = 'Alpha', token = 'fixture-admin-alpha', stateful = false } = {},
) {
  const calls: { name: string; args: Fields; authorization: string | undefined }[] = [];
  const uploads: { fileName: string; mime: string; bytes: Buffer; fileInfo: Fields }[] = [];
  const sessions = { active: new Set<string>(), created: 0, terminated: 0 };
  const tools: Tool[] = [
    {
      name: 'get_editor_schema',
      description: `Read ${project} rules before editing.`,
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
    },
    {
      name: `list_${project.toLowerCase()}`,
      description: `List ${project} content.`,
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
    },
    {
      name: `update_${project.toLowerCase()}`,
      description: `Edit ${project} draft.`,
      inputSchema: {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: ['title'],
      },
      annotations: { readOnlyHint: false },
    },
    {
      name: `publish_${project.toLowerCase()}`,
      description: `Publish ${project} content.`,
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: false },
    },
  ];
  const server = createServer(async (req, res) => {
    const json = (status: number, value: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(value));
    };

    if (req.headers.authorization !== `Bearer ${token}`) {
      return json(401, { error: 'unauthorised' });
    }

    if (req.url === '/upload' && req.method === 'POST') {
      const chunks: Buffer[] = [];

      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }

      const request = new Request('http://localhost/upload', {
        method: 'POST',
        headers: { 'content-type': req.headers['content-type'] ?? '' },
        body: new Uint8Array(Buffer.concat(chunks)),
      });
      const form = await request.formData();
      const file = form.get('files');

      if (!(file instanceof File)) {
        throw new Error('Missing fixture image');
      }

      uploads.push({
        fileName: file.name,
        mime: file.type,
        bytes: Buffer.from(await file.arrayBuffer()),
        fileInfo: JSON.parse(String(form.get('fileInfo'))),
      });

      return json(200, [
        {
          id: uploads.length,
          name: file.name,
          mime: file.type,
          url: `/uploads/${project}-${uploads.length}.png`,
          size: file.size,
        },
      ]);
    }

    const sessionId = req.headers['mcp-session-id'];

    if (req.url === '/mcp' && stateful && req.method === 'DELETE') {
      if (typeof sessionId !== 'string' || !sessions.active.delete(sessionId)) {
        return json(404, { error: 'session not found' });
      }

      sessions.terminated++;
      res.writeHead(200);
      res.end();

      return;
    }

    if (req.url !== '/mcp' || req.method !== 'POST') {
      return json(405, { error: 'method not allowed' });
    }

    const chunks: Buffer[] = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const rpc = JSON.parse(Buffer.concat(chunks).toString());

    if (stateful) {
      if (rpc.method === 'initialize') {
        const id = randomUUID();
        sessions.active.add(id);
        sessions.created++;
        res.setHeader('mcp-session-id', id);
      } else if (typeof sessionId !== 'string' || !sessions.active.has(sessionId)) {
        return json(404, { error: 'session not found' });
      }
    }

    if (rpc.id === undefined) {
      res.writeHead(202);
      res.end();

      return;
    }

    let result;

    switch (rpc.method) {
      case 'initialize':
        result = {
          protocolVersion: '2025-11-25',
          capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: { name: project, version: '1.0.0' },
          instructions: `${project}: use project schema. Never assume another project's fields.`,
        };
        break;
      case 'ping':
        result = {};
        break;
      case 'tools/list':
        result = { tools };
        break;
      case 'resources/list':
        result = {
          resources: [
            { uri: `strapi://${project}/rules`, name: 'Editorial rules', mimeType: 'text/plain' },
          ],
        };
        break;
      case 'resources/templates/list':
        result = { resourceTemplates: [] };
        break;
      case 'prompts/list':
        result = { prompts: [{ name: 'editorial', description: `${project} editorial workflow` }] };
        break;
      case 'resources/read':
        result = {
          contents: [
            {
              uri: rpc.params.uri,
              text: `${project}: preserve translated fields.`,
              mimeType: 'text/plain',
            },
          ],
        };
        break;
      case 'prompts/get':
        result = {
          messages: [
            {
              role: 'user',
              content: { type: 'text', text: `Edit ${project} drafts before publication.` },
            },
          ],
        };
        break;
      case 'tools/call': {
        calls.push({
          name: rpc.params.name,
          args: rpc.params.arguments,
          authorization: req.headers.authorization,
        });
        const value =
          rpc.params.name === 'get_editor_schema'
            ? {
                project,
                fields: project === 'Alpha' ? ['title', 'html'] : ['headline', 'blocks'],
                rules: `${project}: explicit publication only.`,
              }
            : { project, received: rpc.params.arguments };
        result = {
          content: [{ type: 'text', text: JSON.stringify(value) }],
          structuredContent: value,
        };
        break;
      }
      default:
        json(200, { jsonrpc: '2.0', id: rpc.id, error: { code: -32601, message: 'Unavailable' } });

        return;
    }

    json(200, { jsonrpc: '2.0', id: rpc.id, result });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  );

  return {
    url: `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`,
    token,
    calls,
    uploads,
    sessions,
  };
}
