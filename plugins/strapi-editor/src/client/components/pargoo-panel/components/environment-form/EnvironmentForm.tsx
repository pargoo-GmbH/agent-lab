import React, { useRef, useState } from 'react';
import { checkProfile, removeProfile, run, saveProfile } from '../../../../bridge';
import type { EditorState, Environment, Profile, Project } from '../../../../../shared/types.ts';

type Props = {
  project: Project;
  profile: Profile | null;
  check: EditorState['checks'][string] | undefined;
  disabled: boolean;
  onSaved: () => void;
  onClose: () => void;
};
export const EnvironmentForm: React.FC<Props> = ({
  project,
  profile,
  check,
  disabled,
  onSaved,
  onClose,
}) => {
  const [separate, setSeparate] = useState(profile?.separateUploadToken ?? false);
  const [dirty, setDirty] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const submit = () => {
    if (disabled || !form.current?.reportValidity()) {
      return;
    }

    const data = new FormData(form.current);
    const value = (name: string) => String(data.get(name) ?? '');
    const input = {
      ...(profile ? { id: profile.id, revision: profile.revision } : {}),
      project: project.name,
      name: value('name'),
      environment: value('environment') as Environment,
      cmsUrl: value('cmsUrl'),
      maxFileSizeMb: Number(value('maxSize')),
      separateUploadToken: separate,
    };
    const tokens = { mcp: value('mcpToken'), upload: separate ? value('uploadToken') : '' };

    for (const name of ['mcpToken', 'uploadToken']) {
      const field = form.current?.elements.namedItem(name) as HTMLInputElement | null;

      if (field) {
        field.value = '';
      }
    }

    void run(async () => {
      await saveProfile(project.id, input, tokens);
      onSaved();
    });
  };

  return (
    <>
      <form
        ref={form}
        className="environment-form"
        autoComplete="off"
        onChange={() => setDirty(true)}
        onSubmit={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
            event.preventDefault();
            submit();
          }
        }}
      >
        <div className="page-heading">
          <div className="row">
            <h1>{profile ? 'Environment settings' : 'Add environment'}</h1>
            {profile && (
              <button
                className="danger quiet"
                type="button"
                disabled={disabled}
                onClick={() => dialog.current?.showModal()}
              >
                Remove environment…
              </button>
            )}
          </div>
          <p>Project {project.name}</p>
        </div>
        <fieldset disabled={disabled}>
          <label htmlFor="environment-name">Environment name</label>
          <input
            id="environment-name"
            name="name"
            defaultValue={profile?.name ?? ''}
            required
            maxLength={100}
            placeholder="e.g. Main website or Editor sandbox"
          />
          <label htmlFor="environment-type">Type</label>
          <select
            id="environment-type"
            name="environment"
            defaultValue={profile?.environment ?? 'dev'}
          >
            <option value="dev">Development — testing</option>
            <option value="production">Production — live</option>
          </select>
          <p className="hint">
            Production is live. Only publishing and unpublishing require confirmation in this panel.
          </p>
          <label htmlFor="cms-url">Strapi URL</label>
          <input
            id="cms-url"
            name="cmsUrl"
            type="url"
            required
            defaultValue={profile?.cmsUrl ?? ''}
            placeholder="https://cms.example.com"
          />
          <p className="hint">Use the address before /admin.</p>
          <label htmlFor="mcp-token">Strapi Admin token</label>
          <input
            id="mcp-token"
            name="mcpToken"
            type="password"
            required={!profile}
            autoComplete="new-password"
            spellCheck={false}
          />
          <p className="hint">
            Saved in macOS Keychain.
            {profile
              ? ' Leave blank to keep the token. Changing the type or URL requires a token for the new target.'
              : ' Used for content and image uploads.'}
          </p>
          <details className="advanced">
            <summary>Advanced settings</summary>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={separate}
                onChange={(event) => setSeparate(event.target.checked)}
              />
              Separate token for image uploads
            </label>
            {separate && (
              <>
                <label htmlFor="upload-token">Upload Admin token</label>
                <input
                  id="upload-token"
                  name="uploadToken"
                  type="password"
                  required={!profile || !profile.separateUploadToken}
                  autoComplete="new-password"
                  spellCheck={false}
                />
              </>
            )}
            <label htmlFor="max-size">Maximum image size in MiB</label>
            <input
              id="max-size"
              name="maxSize"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              defaultValue={profile?.maxFileSizeMb ?? 10}
              required
            />
          </details>
          {profile && (
            <div className="connection-check">
              <button
                type="button"
                disabled={dirty || disabled}
                onClick={() => void run(() => checkProfile(profile))}
              >
                Check connection
              </button>
              {dirty ? (
                <p className="hint">Save changes before checking this environment.</p>
              ) : (
                <p className={`check-status ${check?.status ?? ''}`} role="status">
                  {check
                    ? `${check.status === 'connected' ? 'MCP connected' : 'Connection needs attention'} · ${new Date(check.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Connection not checked'}
                </p>
              )}
              {!dirty && check?.message && <p className="hint">{check.message}</p>}
            </div>
          )}
          <div className="actions">
            <button className="primary" type="button" onClick={submit}>
              {profile ? 'Save environment' : 'Add environment'}
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
          <p className="hint">
            Saving does not activate an environment. Use its row to confirm it for this chat.
          </p>
        </fieldset>
      </form>
      {profile && (
        <dialog ref={dialog} aria-labelledby="remove-title">
          <h2 id="remove-title">Remove {profile.name}?</h2>
          <p>
            This removes the saved environment and its credentials from this Mac. Content in Strapi
            is kept.
          </p>
          <div className="actions">
            <button
              className="danger"
              disabled={disabled}
              onClick={() =>
                void run(async () => {
                  dialog.current?.close();
                  await removeProfile(profile);
                  onClose();
                })
              }
            >
              Remove environment
            </button>
            <button disabled={disabled} onClick={() => dialog.current?.close()}>
              Cancel
            </button>
          </div>
        </dialog>
      )}
    </>
  );
};
