import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createEditor, createServer as createMcpServer } from '../src/server/index.ts';
import { MemoryCredentials, fixture } from '../src/server/fixtures.ts';
import { Upstream } from '../src/server/strapi/mcp-client.ts';
import { uploadImage } from '../src/server/strapi/media-upload.ts';

// Development browser harness only: isolated temp storage, synthetic tokens and fixture CMSs.
const root = fileURLToPath(new URL('..', import.meta.url));
const cleanup: Array<() => void | Promise<void>> = [];
const t = { after: (callback: () => void | Promise<void>) => cleanup.push(callback) };
const alpha = await fixture(t),
  bravo = await fixture(t, { project: 'Bravo', token: 'fixture-admin-bravo' });
const directory = await mkdtemp(join(tmpdir(), 'strapi-editor-preview-'));
const image = join(directory, 'demo.png');
await writeFile(
  image,
  Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082',
    'hex',
  ),
);
const credentials = new MemoryCredentials();
const fetchFixture: typeof fetch = (url, init) => {
  const target = new URL(typeof url === 'string' || url instanceof URL ? url : url.url);
  const routed =
    target.origin === 'https://production.example.invalid' ? alpha.url + target.pathname : url;

  return fetch(routed, init);
};
const editor = createEditor({
  directory,
  credentials,
  native: { chooseFile: async () => ({ ok: true, path: image, name: 'demo.png' }) },
  upstream: new Upstream(credentials, { fetchImpl: fetchFixture }),
  upload: (input, config) => uploadImage(input, config, { fetchImpl: fetchFixture }),
});

for (const [project, cms] of [
  ['Alpha', alpha],
  ['Bravo', bravo],
] as const) {
  await editor.profiles.save(
    { project, name: 'Editor sandbox', environment: 'dev', cmsUrl: cms.url },
    { mcp: cms.token },
  );
}

await editor.profiles.save(
  {
    project: 'Alpha',
    name: 'Main website',
    environment: 'production',
    cmsUrl: 'https://production.example.invalid',
  },
  { mcp: alpha.token },
);
const mcp = createMcpServer(editor, { htmlPath: join(root, 'dist/ui/editor.html') });
const client = new Client({ name: 'browser-test-host', version: '1.0.0' });
const [a, b] = InMemoryTransport.createLinkedPair();
await mcp.connect(a);
await client.connect(b);
const host = await build({
  entryPoints: [join(root, 'scripts/dev/host.ts')],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  write: false,
});
const html = await readFile(join(root, 'scripts/dev/index.html'), 'utf8');
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html);

      return;
    }

    if (req.method === 'GET' && url.pathname === '/host.js') {
      res.writeHead(200, { 'content-type': 'application/javascript' });
      res.end(host.outputFiles[0].text);

      return;
    }

    if (req.method === 'GET' && url.pathname === '/frame') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(await readFile(join(root, 'dist/ui/editor.html')));

      return;
    }

    if (req.method === 'POST' && url.pathname === '/scenario') {
      const chunks = [];

      for await (const chunk of req) {
        chunks.push(chunk);
      }

      const { contextId } = JSON.parse(Buffer.concat(chunks).toString());
      const { profile } = await editor.contexts.require(contextId);
      const catalogue = await editor.upstream.discover(profile);
      const publish = catalogue.tools.find((tool) => tool.name.startsWith('publish_'));
      const result = await client.callTool({
        name: 'strapi_call',
        arguments: { contextId, toolName: publish!.name, arguments: {}, requestId: randomUUID() },
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));

      return;
    }

    if (req.method === 'POST' && url.pathname === '/call') {
      const chunks = [];

      for await (const chunk of req) {
        chunks.push(chunk);
      }

      const result = await client.callTool(JSON.parse(Buffer.concat(chunks).toString()));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));

      return;
    }

    res.writeHead(404);
    res.end();
  } catch {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({ isError: true, content: [{ type: 'text', text: 'Test harness error' }] }),
    );
  }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
console.log(
  `Browser test harness: http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`,
);
console.log('Synthetic local CMSs only. No real Keychain or project credentials are used.');
const stop = async () => {
  server.close();
  server.closeAllConnections();
  await client.close();
  await mcp.close();

  for (const callback of cleanup) {
    await callback();
  }

  await rm(directory, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
