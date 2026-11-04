import type { Store } from './store.ts';
import type { Credentials, ProfileSettings, StoredProfile, Tokens } from '../types.ts';
import { createHash, randomUUID } from 'node:crypto';
import { EditorError, publicProfile, requireValue } from '../errors.ts';
import { isId } from './store.ts';
import { Projects } from './projects.ts';

const isCredentialReference = (key: unknown): key is string =>
  typeof key === 'string' && key.split(':').length === 2 && key.split(':').every(isId);

function text(value: unknown, label: string) {
  requireValue(
    typeof value === 'string' &&
      value.trim().length > 0 &&
      value.trim().length <= 100 &&
      !/[\x00-\x1f]/.test(value),
    'PROFILE_INVALID',
    `${label} must contain 1–100 characters.`,
  );

  return value.trim();
}

export function normalizeProfile(input: ProfileSettings) {
  requireValue(
    input && typeof input === 'object',
    'PROFILE_INVALID',
    'Enter the connection details.',
  );
  const project = text(input.project, 'Project');
  const name = text(input.name, 'Environment name');
  requireValue(
    ['dev', 'production'].includes(input.environment),
    'PROFILE_INVALID',
    'Choose Development or Production explicitly.',
  );
  let url;
  try {
    url = new URL(input.cmsUrl);
  } catch {
    throw new EditorError('PROFILE_INVALID', 'Enter a valid Strapi base URL.');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  requireValue(
    (url.protocol === 'https:' ||
      (input.environment === 'dev' && loopback && url.protocol === 'http:')) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
    'PROFILE_INVALID',
    'Use HTTPS without credentials, query parameters or fragments. HTTP is allowed only for a local Development CMS.',
  );
  const cmsUrl = url.origin + url.pathname.replace(/\/+$/, '');
  requireValue(
    !/\/(admin|mcp|api\/upload|upload)$/.test(cmsUrl),
    'PROFILE_INVALID',
    'Use the Strapi base URL, without /admin, /mcp or /upload.',
  );
  const maxFileSizeMb = input.maxFileSizeMb ?? 10;
  requireValue(
    Number.isFinite(maxFileSizeMb) && maxFileSizeMb > 0 && maxFileSizeMb <= 100,
    'PROFILE_INVALID',
    'Image size must be greater than 0 and at most 100 MiB.',
  );

  return {
    project,
    name,
    environment: input.environment,
    cmsUrl,
    mcpUrl: cmsUrl + '/mcp',
    maxFileSizeMb,
  };
}

export class Profiles {
  store: Store;
  credentials: Credentials;
  constructor(store: Store, credentials: Credentials) {
    this.store = store;
    this.credentials = credentials;
  }

  async list() {
    return (await this.store.profiles()).map(publicProfile);
  }

  async cleanupSettings() {
    const settings = await this.store.read<{ version: number; references: string[] }>(
      'credential-cleanup.json',
      {
        version: 1,
        references: [],
      },
    );
    requireValue(
      settings?.version === 1 &&
        Array.isArray(settings.references) &&
        settings.references.every(isCredentialReference),
      'SETTINGS_VERSION',
      'The credential cleanup settings are unsupported. Existing settings have been preserved.',
    );

    return settings;
  }

  async queueCleanup(references: string[]) {
    requireValue(
      references.every(isCredentialReference),
      'PROFILE_INVALID',
      'A saved environment has invalid credential references. Existing settings have been preserved.',
    );
    const settings = await this.cleanupSettings();
    await this.store.write('credential-cleanup.json', {
      version: 1,
      references: [...new Set([...settings.references, ...references])],
    });
  }

  async hasPendingCleanup() {
    return (await this.cleanupSettings()).references.length > 0;
  }

  async cleanup() {
    return this.store.lock(async () => this.cleanupLocked());
  }

  async cleanupLocked() {
    const queued = (await this.cleanupSettings()).references;

    if (!queued.length) {
      return { ok: true, credentialCleanupPending: false };
    }

    const retained = new Set(
      (await this.store.profiles()).flatMap((profile) => [
        profile.mcpCredential,
        profile.uploadCredential,
      ]),
    );
    const remaining: string[] = [];

    for (const key of queued) {
      if (retained.has(key)) {
        continue;
      }

      try {
        await this.credentials.delete(key);
      } catch {
        remaining.push(key);
      }
    }

    // The durable queue holds opaque Keychain references, never token values.
    // If saving the reduced queue fails, its previous entries remain retryable.
    try {
      await this.store.write('credential-cleanup.json', { version: 1, references: remaining });
    } catch {
      return { ok: false, credentialCleanupPending: true };
    }

    return { ok: remaining.length === 0, credentialCleanupPending: remaining.length > 0 };
  }

  async get(id: string) {
    requireValue(isId(id), 'PROFILE_NOT_FOUND', 'Choose a saved connection.');
    const profile = (await this.store.profiles()).find((p) => p.id === id);
    requireValue(
      profile,
      'PROFILE_NOT_FOUND',
      'This connection no longer exists. Choose another connection.',
    );
    const normalized = normalizeProfile(profile);
    requireValue(
      profile.cmsUrl === normalized.cmsUrl && profile.mcpUrl === normalized.mcpUrl,
      'PROFILE_INVALID',
      'The stored connection has an invalid CMS/MCP target. Edit it through the connection form.',
    );

    return profile;
  }

  async save(input: ProfileSettings, tokens: Tokens = {}, projectId?: string) {
    const fields = normalizeProfile(input);

    if (input.id !== undefined) {
      requireValue(isId(input.id), 'PROFILE_INVALID', 'Invalid connection identifier.');
    }

    for (const token of Object.values(tokens)) {
      requireValue(
        typeof token === 'string' &&
          (!token || /^[\x21-\x7e]+$/.test(token)) &&
          token.length <= 16384,
        'CREDENTIAL_INVALID',
        'Enter a valid Admin token in the connection form.',
      );
    }

    return this.store.lock(async () => {
      if (projectId !== undefined) {
        const project = await new Projects(this.store).get(projectId);
        requireValue(
          fields.project === project.name,
          'PROJECT_CHANGED',
          'The environment does not belong to the selected project. Reopen its settings.',
        );
      }

      const profiles = await this.store.profiles();
      const previous = input.id ? profiles.find((p) => p.id === input.id) : undefined;

      if (input.id) {
        requireValue(previous, 'PROFILE_NOT_FOUND', 'This connection no longer exists.');
      }

      if (previous) {
        requireValue(
          input.revision === previous.revision,
          'PROFILE_CHANGED',
          'This connection changed in another window. Reload before saving.',
        );
      }

      requireValue(
        !profiles.some(
          (p) =>
            p.id !== previous?.id &&
            p.project === fields.project &&
            p.name.toLowerCase() === fields.name.toLowerCase(),
        ),
        'PROFILE_DUPLICATE',
        'Use a different environment name within this project.',
      );
      const id = previous?.id ?? randomUUID();
      const targetChanged =
        previous &&
        (previous.cmsUrl !== fields.cmsUrl ||
          previous.environment !== fields.environment ||
          previous.project !== fields.project);

      if (targetChanged) {
        requireValue(
          tokens.mcp && (input.separateUploadToken ? tokens.upload : true),
          'CREDENTIAL_REQUIRED',
          'The target changed. Enter credentials for the new target; credentials are never transferred automatically.',
        );
      }

      const next: StoredProfile = {
        mcpCredential: previous?.mcpCredential ?? '',
        uploadCredential: previous?.uploadCredential ?? '',
        ...fields,
        id,
        revision: randomUUID(),
        createdAt: previous?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const put = async (token: string) => {
        const key = `${id}:${randomUUID()}`;
        await this.queueCleanup([key]);
        await this.credentials.set(key, token);

        return key;
      };
      try {
        next.mcpCredential = tokens.mcp ? await put(tokens.mcp) : (previous?.mcpCredential ?? '');
        requireValue(
          next.mcpCredential,
          'CREDENTIAL_REQUIRED',
          'Enter the Strapi MCP Admin token.',
        );

        if (input.separateUploadToken) {
          next.uploadCredential =
            (tokens.upload
              ? await put(tokens.upload)
              : !targetChanged && previous?.uploadCredential !== previous?.mcpCredential
                ? previous?.uploadCredential
                : undefined) ?? '';
          requireValue(
            next.uploadCredential,
            'CREDENTIAL_REQUIRED',
            'Enter the separate upload Admin token.',
          );
        } else {
          next.uploadCredential = next.mcpCredential;
        }

        const retired = [previous?.mcpCredential, previous?.uploadCredential].filter(
          (key): key is string => Boolean(key),
        );
        await this.queueCleanup(retired);
        await this.store.write('profiles.json', {
          version: 1,
          profiles: [...profiles.filter((p) => p.id !== id), next],
        });
      } catch (error) {
        await this.cleanupLocked();
        throw error;
      }
      await this.cleanupLocked();

      return publicProfile(next);
    });
  }

  async remove(id: string, revision: string) {
    return this.store.lock(async () => {
      const current = await this.get(id);
      requireValue(
        current.revision === revision,
        'PROFILE_CHANGED',
        'This connection changed in another window. Reload before removing it.',
      );
      await this.queueCleanup([...new Set([current.mcpCredential, current.uploadCredential])]);
      await this.store.write('profiles.json', {
        version: 1,
        profiles: (await this.store.profiles()).filter((p) => p.id !== id),
      });

      return this.cleanupLocked();
    });
  }
}

export function profileFingerprint(profile: StoredProfile) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        profile.id,
        profile.revision,
        profile.project,
        profile.cmsUrl,
        profile.mcpUrl,
        profile.environment,
        profile.mcpCredential,
        profile.uploadCredential,
      ]),
    )
    .digest('hex');
}
