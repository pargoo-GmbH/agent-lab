import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { PendingRequest, RpcResponse } from '../../src/server/types.ts';
import type { AppTool } from '../../src/server/index.ts';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { mkdtemp, cp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import readline from 'node:readline';
import type { readRegistration as ReadRegistration } from '../check.ts';

type ServerStatus = {
  data: {
    pluginId: string;
    toolsError: unknown;
    serverInfo: { version: string };
    tools: Record<string, AppTool>;
  }[];
};

export async function checkDesktop(readRegistration: typeof ReadRegistration) {
  const execute = promisify(execFile);
  const bundle = resolve(
    process.env.STRAPI_EDITOR_PACKAGE_DIR ?? fileURLToPath(new URL('../../dist', import.meta.url)),
  );
  const { manifest } = await readRegistration(bundle);
  const binary =
    process.env.STRAPI_EDITOR_CODEX_BIN ?? process.env.CODEX_APP_RUNTIME_CLI_PATH ?? 'codex';
  const directory = await mkdtemp(join(tmpdir(), 'strapi-editor-desktop-'));
  const marketplace = `strapi-editor-check-${Date.now()}`;
  const plugin = `strapi-editor@${marketplace}`;
  const flags = [
    '-c',
    `marketplaces.${marketplace}.source_type="local"`,
    '-c',
    `marketplaces.${marketplace}.source=${JSON.stringify(directory)}`,
  ];
  let installed = false;
  let child: ChildProcessWithoutNullStreams | undefined;
  let lines;
  let serial = 0;
  const pending = new Map<number, PendingRequest<unknown>>();
  let stderr = '';

  async function cli(args: string[]) {
    return execute(binary, [...flags, ...args], { cwd: directory, timeout: 30_000 });
  }

  function request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Desktop check timed out: ${method}`));
      }, 25_000);
      pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
      child!.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }

  try {
    await mkdir(join(directory, '.agents/plugins'), { recursive: true });
    await cp(bundle, join(directory, 'plugins/strapi-editor'), { recursive: true });
    await writeFile(
      join(directory, '.agents/plugins/marketplace.json'),
      JSON.stringify({
        name: marketplace,
        plugins: [
          {
            name: 'strapi-editor',
            source: { source: 'local', path: './plugins/strapi-editor' },
            policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
            category: 'Productivity',
          },
        ],
      }),
    );
    const install = JSON.parse((await cli(['plugin', 'add', plugin, '--json'])).stdout);
    installed = true;
    assert.equal(install.pluginId, plugin);
    const inventoryArgs = process.env.STRAPI_EDITOR_INVENTORY_MARKETPLACE
      ? ['--marketplace', process.env.STRAPI_EDITOR_INVENTORY_MARKETPLACE]
      : [];
    const inventory = JSON.parse(
      (await cli(['plugin', 'list', ...inventoryArgs, '--json'])).stdout,
    ) as { installed: { name: string; pluginId: string }[] };
    const competing = inventory.installed.filter(
      (entry) => entry.name === manifest.name && entry.pluginId !== plugin,
    );
    const isolate = competing.flatMap((entry) => {
      assert(/^[a-zA-Z0-9_@-]+$/.test(entry.pluginId), 'Unsupported diagnostic override key.');

      return ['-c', `plugins.${entry.pluginId}.enabled=false`];
    });
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      STRAPI_EDITOR_DATA_DIR: join(directory, 'data'),
    };
    // Keep this independent process out of the calling chat's tool bridge.
    delete env.CODEX_APP_TOOLS_PIPE_PATH;
    delete env.CODEX_THREAD_ID;
    delete env.CODEX_SESSION_ID;
    child = spawn(
      binary,
      [
        ...flags,
        '-c',
        'plugins._default.enabled=false',
        ...isolate,
        '-c',
        `plugins.${plugin}.enabled=true`,
        'app-server',
        '--stdio',
      ],
      { cwd: directory, env, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      for (const entry of pending.values()) {
        entry.reject(error);
      }
    });
    child.on('exit', (code) => {
      for (const entry of pending.values()) {
        entry.reject(new Error(`Diagnostic host exited (${code}).`));
      }
    });
    lines = readline.createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      let message: RpcResponse;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      const entry = pending.get(message.id);

      if (!entry) {
        return;
      }

      pending.delete(message.id);
      clearTimeout(entry.timer);

      if (message.error) {
        entry.reject(new Error(JSON.stringify(message.error)));
      } else {
        entry.resolve(message.result);
      }
    });
    const host = await request<{ userAgent: string }>('initialize', {
      clientInfo: { name: 'strapi-editor-package-check', version: '1.0.0' },
      capabilities: { experimentalApi: true },
    });
    child!.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    // The host resolves the package and launches only the selected MCP. No model
    // turn, profile creation, credentials, content calls or CMS writes are used.
    const status = await request<ServerStatus>('mcpServerStatus/list', {
      serverName: 'strapi-editor',
      detail: 'toolsAndAuthOnly',
    });
    const server = status.data.find((entry) => entry.pluginId === plugin);
    assert(server, 'The desktop loader did not register the bundled MCP server.');
    assert.equal(server.toolsError, null);
    assert.equal(server.serverInfo.version, manifest.version);
    const names = Object.keys(server.tools).sort();
    assert.deepEqual(names, [
      'strapi_call',
      'strapi_choose_image',
      'strapi_discover',
      'strapi_editor_context',
      'strapi_editor_open',
      'strapi_editor_ui',
      'strapi_get_prompt',
      'strapi_operation_status',
      'strapi_read_resource',
      'strapi_upload_image',
    ]);
    assert.equal(
      server.tools.strapi_editor_open._meta?.ui?.resourceUri,
      'ui://strapi-editor/editor.html',
    );
    assert.deepEqual(server.tools.strapi_editor_ui._meta?.ui?.visibility, ['app']);

    for (const name of ['strapi_call', 'strapi_upload_image', 'strapi_editor_ui']) {
      assert.equal(server.tools[name]._meta?.ui?.resourceUri, undefined);
    }

    console.log(
      `Desktop loader passed: Pargoo ${manifest.version}, ${names.length} tools, app metadata. ${host.userAgent}`,
    );
  } catch (error) {
    const relevant = stderr
      .split('\n')
      .filter((line) => /strapi-editor|failed to parse plugin MCP/.test(line))
      .slice(-5)
      .join('\n');

    if (relevant) {
      console.error(relevant);
    }

    throw error;
  } finally {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
    }

    lines?.close();

    if (child && child.exitCode === null) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          child!.kill('SIGKILL');
          resolve();
        }, 5_000);
        child!.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
        child!.kill('SIGTERM');
      });
    }

    if (installed) {
      const removed = JSON.parse((await cli(['plugin', 'remove', plugin, '--json'])).stdout);
      assert.equal(removed.pluginId, plugin, 'Diagnostic installation cleanup failed.');
    }

    await rm(directory, { recursive: true, force: true });
  }
}
