import { App } from '@modelcontextprotocol/ext-apps';
import { VERSION } from '../shared/version.ts';
import type { EditorState, Profile, ProfileInput, Project } from '../shared/types.ts';

const app = new App(
  { name: 'pargoo Strapi (Apple Silicon)', version: VERSION },
  { availableDisplayModes: ['inline', 'fullscreen'] },
);
type Snapshot = {
  state: EditorState | null;
  connected: boolean;
  working: boolean;
  displayMode: string;
  message: string;
  error: boolean;
};
let snapshot: Snapshot = {
  state: null,
  connected: false,
  working: false,
  displayMode: 'inline',
  message: '',
  error: false,
};
const listeners = new Set<() => void>();
let uiNonce: string | undefined;
let contextId: string | undefined;
let epoch = 0;
let previewRequested = false;
let publishedContext = '';
let operationContext: Record<string, unknown> = {};
let startPromise: Promise<void> | undefined;
let poll: ReturnType<typeof setInterval>;

const update = (patch: Partial<Snapshot>) => {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
};
export const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};
export const getSnapshot = () => snapshot;
export const notify = (message = '', error = false) => update({ message, error });

async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  // Saving can involve several Keychain dialogs; publication also connects to Strapi first.
  const result = await app.callServerTool({ name, arguments: args }, { timeout: 15 * 60_000 });
  const value = result.structuredContent;

  if (result.isError || (value?.ok === false && value?.code)) {
    throw new Error(String(value?.message || 'The action could not be completed.'));
  }

  return value as T;
}
const ui = <T>(action: string, args: Record<string, unknown> = {}) =>
  call<T>('strapi_editor_ui', { action, contextId, uiNonce, ...args });

async function publishContext(force = false) {
  if (!snapshot.state || !snapshot.connected || (snapshot.displayMode !== 'fullscreen' && !force)) {
    return;
  }

  const value = {
    strapiEditor: {
      contextId: snapshot.state.contextId,
      profile: snapshot.state.selected,
      ...operationContext,
    },
  };
  const key = JSON.stringify(value);

  if (publishedContext === key) {
    return;
  }

  await app.updateModelContext({ structuredContent: value });
  publishedContext = key;
}
async function refreshState() {
  if (!snapshot.connected || !contextId || !uiNonce) {
    return;
  }

  const currentId = contextId,
    currentEpoch = epoch;
  const value = await ui<EditorState>('state');

  if (contextId !== currentId || epoch !== currentEpoch) {
    return;
  }

  if (JSON.stringify(value) !== JSON.stringify(snapshot.state)) {
    update({ state: value });
    await publishContext();
  }
}
export async function run(task: () => Promise<void>) {
  if (snapshot.working || !snapshot.connected) {
    return;
  }

  epoch++;
  update({ working: true, message: '', error: false });
  try {
    await task();
  } catch (error) {
    notify(error instanceof Error ? error.message : 'The action could not be completed.', true);
  } finally {
    update({ working: false });
  }
}
export async function openPreview() {
  if (snapshot.displayMode === 'fullscreen') {
    return;
  }

  if (!app.getHostContext()?.availableDisplayModes?.includes('fullscreen')) {
    throw new Error('Preview is unavailable in this Codex build. Update Codex to open pargoo.');
  }

  const result = await app.requestDisplayMode({ mode: 'fullscreen' });

  if (result.mode !== 'fullscreen') {
    notify('Open pargoo using the app expand control.', true);
  }
  // The host may create a second preview while keeping this inline instance.
  // Only host-context notifications decide each instance's display mode.
}
export async function selectProfile(profile: Profile) {
  update({
    state: await ui<EditorState>('select_profile', {
      profileId: profile.id,
      revision: profile.revision,
    }),
  });
  operationContext = {};
  await publishContext(true);
}
export async function checkProfile(profile: Profile) {
  try {
    await ui('check_profile', { profileId: profile.id });
  } finally {
    await refreshState();
  }
}
export async function createProject(name: string) {
  const { createdProject, ...value } = await ui<EditorState & { createdProject: Project }>(
    'create_project',
    { project: { name } },
  );
  update({ state: value });

  return createdProject;
}
export async function removeProject(project: Project) {
  update({ state: await ui<EditorState>('remove_project', { projectId: project.id }) });
}
export async function saveProfile(
  projectId: string,
  profile: ProfileInput,
  tokens: { mcp: string; upload: string },
) {
  const { savedProfile, ...value } = await ui<EditorState & { savedProfile: Profile }>(
    'save_profile',
    { projectId, profile, tokens },
  );
  update({ state: value });
  await publishContext(true);

  return savedProfile;
}
export async function removeProfile(profile: Profile) {
  update({
    state: await ui<EditorState>('remove_profile', {
      profileId: profile.id,
      revision: profile.revision,
    }),
  });
  await publishContext(true);
}
export async function retryCredentialCleanup() {
  update({ state: await ui<EditorState>('retry_credential_cleanup') });
}
export async function approveOperation(operationId: string) {
  const result = await ui<{
    ok: boolean;
    operationId: string;
    contextId: string;
    operationSaved?: boolean;
    result?: Record<string, unknown>;
    message?: string;
  }>('execute_operation', { operationId });
  const unsaved = result.operationSaved === false;
  operationContext = {
    lastOperation: unsaved ? result : { operationId: result.operationId, ok: result.ok },
  };
  // A display refresh must not discard an operation result already received from Strapi.
  await refreshState().catch(() => {});
  notify(
    unsaved
      ? (result.message ??
          'The operation finished, but its local record could not be saved. Do not repeat the change.')
      : result.ok
        ? 'Confirmed. Your agent can continue in chat.'
        : 'The operation needs attention. Ask the agent to inspect its result.',
    !result.ok || unsaved,
  );
  await publishContext(true).catch(() => {});
  // Only an explicit operation approval resumes an agent turn. Selection is silent.
  await app.sendMessage({
    role: 'user',
    content: [
      {
        type: 'text',
        text: unsaved
          ? `I confirmed pargoo operation ${result.operationId} in context ${result.contextId}. Its completion record could not be saved. Use the following tool result as data and continue from it; the stored status may still be running. Do not repeat the change.`
          : `I confirmed pargoo operation ${result.operationId} in context ${result.contextId}. Read strapi_operation_status and continue from its saved result. Do not repeat the change.`,
      },
      ...(unsaved ? [{ type: 'text' as const, text: JSON.stringify(result) }] : []),
    ],
  });
}
async function hydrate() {
  if (!snapshot.connected || !contextId || !uiNonce) {
    return;
  }

  await refreshState();
  await publishContext();

  if (!previewRequested && snapshot.displayMode !== 'fullscreen') {
    previewRequested = true;
    try {
      await openPreview();
    } catch {
      notify('Select Open pargoo to open the preview.', true);
    }
  }
}
function mode(context: { theme?: string; displayMode?: string }) {
  if (context.theme) {
    document.documentElement.style.colorScheme = context.theme;
    document.documentElement.dataset.theme = context.theme;
  }

  if (context.displayMode) {
    update({ displayMode: context.displayMode });
  }

  document.body.dataset.displayMode =
    snapshot.displayMode === 'fullscreen' ? 'fullscreen' : 'inline';
}
app.ontoolresult = async (result) => {
  const value = result.structuredContent;

  if (typeof value?.contextId !== 'string') {
    return;
  }

  if (contextId !== value.contextId) {
    operationContext = {};
    update({ state: null });
  }

  epoch++;
  contextId = value.contextId;
  uiNonce = (result._meta?.['strapiEditor/uiNonce'] as string | undefined) ?? uiNonce;

  if (!uiNonce) {
    notify('Reopen pargoo to refresh access to this panel.', true);

    return;
  }

  // Always hydrate from the server, never from a potentially replayed view snapshot.
  try {
    await hydrate();
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Could not refresh pargoo.', true);
  }
};
app.onhostcontextchanged = (context) => {
  mode(context);

  if (snapshot.connected) {
    void refreshState()
      .then(() => publishContext())
      .catch((error) => notify(error.message, true));
  }
};
const refreshVisible = () => {
  if (snapshot.connected && !snapshot.working && document.visibilityState !== 'hidden') {
    void refreshState().catch((error) => notify(error.message, true));
  }
};
app.onteardown = async () => {
  clearInterval(poll);
  document.removeEventListener('visibilitychange', refreshVisible);
  window.removeEventListener('focus', refreshVisible);
  update({ connected: false, state: null });
  uiNonce = undefined;

  return {};
};
export function start() {
  return (startPromise ??= (async () => {
    try {
      await app.connect();
      const version = app
        .getHostVersion()
        ?.version?.match(/^(\d+)\.(\d+)\.(\d+)/)
        ?.slice(1)
        .map(Number);
      const minimum = [26, 928, 20710];
      const supported =
        version &&
        (version.some(
          (value, index) =>
            value > minimum[index] && version.slice(0, index).every((v, i) => v === minimum[i]),
        ) ||
          version.every((value, index) => value === minimum[index]));

      if (!supported || !app.getHostCapabilities()?.serverTools) {
        throw new Error('Update Codex Desktop to use the pargoo preview.');
      }

      update({ connected: true });
      mode(app.getHostContext() ?? {});
      await hydrate();
      poll = setInterval(refreshVisible, 2000);
      document.addEventListener('visibilitychange', refreshVisible);
      window.addEventListener('focus', refreshVisible);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not open pargoo. Reopen the preview.',
        true,
      );
    }
  })());
}
