import type { Credentials, StoredProfile } from '../types.ts';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { EditorError, requireValue } from '../errors.ts';
import { VERSION } from '../../shared/version.ts';

export type ToolCall = () => ReturnType<Client['callTool']>;

export class Upstream {
  credentials: Credentials;
  fetchImpl: typeof globalThis.fetch;
  constructor(credentials: Credentials, { fetchImpl = globalThis.fetch } = {}) {
    this.credentials = credentials;
    this.fetchImpl = fetchImpl;
  }

  async use<T>(profile: StoredProfile, task: (client: Client) => Promise<T>): Promise<T> {
    const token = await this.credentials.get(profile.mcpCredential);
    const client = new Client({ name: 'strapi-editor', version: VERSION });
    const expected = new URL(profile.mcpUrl);
    const transport = new StreamableHTTPClientTransport(expected, {
      requestInit: { headers: { Authorization: `Bearer ${token}` }, redirect: 'manual' },
      reconnectionOptions: {
        maxRetries: 0,
        initialReconnectionDelay: 1000,
        maxReconnectionDelay: 1000,
        reconnectionDelayGrowFactor: 1,
      },
      fetch: async (url, init) => {
        const target = new URL(url);
        requireValue(
          target.origin === expected.origin &&
            target.pathname === expected.pathname &&
            !target.search &&
            !target.hash,
          'TARGET_MISMATCH',
          'An MCP request tried to leave the configured Strapi endpoint.',
        );
        const response = await this.fetchImpl(url, {
          ...init,
          redirect: 'manual',
          signal: init?.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(60_000)])
            : AbortSignal.timeout(60_000),
        });

        if (response.status === 401 || response.status === 403) {
          throw new EditorError(
            'ACCESS_DENIED',
            'The Strapi token is expired or lacks the required permissions.',
            { status: response.status },
          );
        }

        if (response.status >= 300 && response.status < 400) {
          throw new EditorError(
            'REDIRECT_BLOCKED',
            'Strapi redirected the request. Check the exact CMS base URL before reconnecting.',
          );
        }

        return response;
      },
    });
    try {
      await client.connect(transport, { timeout: 60_000 });

      return await task(client);
    } catch (error) {
      if (error instanceof EditorError) {
        throw error;
      }

      throw new EditorError(
        'MCP_CONNECTION_FAILED',
        'Strapi MCP could not complete the request. Check the address, token permissions and Strapi MCP compatibility.',
      );
    } finally {
      // Cleanup must not replace a confirmed result or the original request failure.
      await transport.terminateSession().catch(() => {});
      await client.close().catch(() => {});
    }
  }

  async tools(client: Client) {
    const tools: Tool[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;

    do {
      const page = await client.listTools(cursor ? { cursor } : {});
      tools.push(...page.tools);
      cursor = page.nextCursor;
      requireValue(
        tools.length <= 2000 && (!cursor || !seen.has(cursor)),
        'MCP_CATALOG_INVALID',
        'The Strapi tool catalogue is too large or has invalid pagination.',
      );

      if (cursor) {
        seen.add(cursor);
      }
    } while (cursor);

    return tools;
  }

  async pages<T>(
    load: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>,
  ): Promise<T[]> {
    const items: T[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;

    do {
      const page = await load(cursor);
      items.push(...page.items);
      cursor = page.nextCursor;
      requireValue(
        items.length <= 2000 && (!cursor || !seen.has(cursor)),
        'MCP_CATALOG_INVALID',
        'The MCP catalogue has invalid pagination.',
      );

      if (cursor) {
        seen.add(cursor);
      }
    } while (cursor);

    return items;
  }

  async discover(profile: StoredProfile) {
    return this.use(profile, async (client) => {
      const capabilities = client.getServerCapabilities() ?? {};

      return {
        server: client.getServerVersion(),
        instructions: client.getInstructions() ?? '',
        tools: await this.tools(client),
        resources: capabilities.resources
          ? await this.pages(async (cursor) => {
              const page = await client.listResources(cursor ? { cursor } : {});

              return { items: page.resources, nextCursor: page.nextCursor };
            })
          : [],
        resourceTemplates: capabilities.resources
          ? await this.pages(async (cursor) => {
              const page = await client.listResourceTemplates(cursor ? { cursor } : {});

              return { items: page.resourceTemplates, nextCursor: page.nextCursor };
            })
          : [],
        prompts: capabilities.prompts
          ? await this.pages(async (cursor) => {
              const page = await client.listPrompts(cursor ? { cursor } : {});

              return { items: page.prompts, nextCursor: page.nextCursor };
            })
          : [],
      };
    });
  }

  async withTool<T>(
    profile: StoredProfile,
    name: string,
    args: Record<string, unknown>,
    task: (tool: Tool, invoke: ToolCall) => Promise<T>,
  ): Promise<T> {
    return this.use(profile, async (client) => {
      const tool = (await this.tools(client)).find((tool) => tool.name === name);
      requireValue(
        tool,
        'TOOL_NOT_AVAILABLE',
        'This tool is not available for the selected Strapi connection and token.',
      );

      return task(tool, () =>
        client.callTool({ name, arguments: args }, undefined, { timeout: 120_000 }),
      );
    });
  }

  async call(profile: StoredProfile, name: string, args: Record<string, unknown> = {}) {
    return this.withTool(profile, name, args, (_tool, invoke) => invoke());
  }

  async resource(profile: StoredProfile, uri: string) {
    return this.use(profile, (client) => client.readResource({ uri }));
  }

  async prompt(profile: StoredProfile, name: string, args: Record<string, string> = {}) {
    return this.use(profile, (client) => client.getPrompt({ name, arguments: args }));
  }

  async check(profile: StoredProfile) {
    const catalogue = await this.discover(profile);

    return {
      ok: true,
      mcp: 'connected',
      server: catalogue.server,
      toolCount: catalogue.tools.length,
      upload: 'credential_saved_not_live_tested',
      message:
        'MCP is connected. Upload permission and file handling require an explicit first test upload.',
    };
  }
}
