import type { CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';

type AppDisplayMode = 'inline' | 'fullscreen';
function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const result = document.getElementById(id);

  if (!result) {
    throw new Error(`Missing preview element: ${id}`);
  }

  return result as T;
}

const call = async (params: CallToolRequest['params']): Promise<CallToolResult> =>
  (
    await fetch('/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  ).json();
const opened = await call({ name: 'strapi_editor_open', arguments: {} });
let messages = 0,
  updates = 0;
function counters(profile?: { name?: string } | null) {
  element('messages').textContent = String(messages);
  element('updates').textContent = String(updates);

  if (profile !== undefined) {
    element('agent-profile').textContent = profile?.name ?? 'None';
  }
}
function bridgeFor(id: string, displayMode: AppDisplayMode) {
  const frame = element<HTMLIFrameElement>(id);
  const bridge = new AppBridge(
    null,
    { name: 'Strapi Editor browser test host', version: '26.1102.00000' },
    { serverTools: {}, serverResources: {}, logging: {} },
    {
      hostContext: {
        displayMode,
        availableDisplayModes: ['inline', 'fullscreen'],
        theme: 'dark',
        platform: 'desktop',
      },
    },
  );
  bridge.oncalltool = (params) => call(params);
  bridge.onupdatemodelcontext = async (params) => {
    updates++;
    counters(
      (
        params.structuredContent as
          { strapiEditor?: { profile?: { name?: string } | null } } | undefined
      )?.strapiEditor?.profile,
    );

    return {};
  };
  bridge.onmessage = async () => {
    messages++;
    counters();

    return {};
  };
  bridge.onrequestdisplaymode = async ({ mode }) => {
    element('preview-column').hidden = false;

    return { mode };
  };
  bridge.oninitialized = async () => {
    await bridge.sendToolInput({ arguments: {} });
    await bridge.sendToolResult(opened);
  };

  return { bridge, frame };
}
const inline = bridgeFor('inline-app', 'inline'),
  preview = bridgeFor('preview-app', 'fullscreen');
await Promise.all(
  [inline, preview].map(async ({ bridge, frame }) => {
    await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
    frame.src = '/frame';
  }),
);
element('prepare').onclick = async () => {
  await fetch('/scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contextId: (opened.structuredContent as { contextId: string }).contextId,
    }),
  });
};
element('replay').onclick = () => preview.bridge.sendToolResult(opened);
element('hide-preview').onclick = () => {
  element('preview-column').hidden = true;
};
element('host-status').textContent = 'Browser harness · Synthetic CMSs only';
