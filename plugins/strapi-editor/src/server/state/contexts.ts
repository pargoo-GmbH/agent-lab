import type { Store } from './store.ts';
import type { Profiles } from './profiles.ts';
import type { Context } from '../types.ts';
import { randomUUID } from 'node:crypto';
import { requireValue, publicProfile } from '../errors.ts';
import { isId } from './store.ts';
import { profileFingerprint } from './profiles.ts';

export class Contexts {
  store: Store;
  profiles: Profiles;
  constructor(store: Store, profiles: Profiles) {
    this.store = store;
    this.profiles = profiles;
  }

  async open() {
    const context: Context = {
      id: randomUUID(),
      uiNonce: randomUUID(),
      createdAt: new Date().toISOString(),
      selection: null,
    };
    await this.store.write(`context-${context.id}.json`, context);

    return context;
  }

  async get(id: string) {
    requireValue(
      isId(id),
      'CONTEXT_REQUIRED',
      'Open Pargoo in this chat and confirm a connection first.',
    );
    const context = await this.store.read<Context | null>(`context-${id}.json`, null);
    requireValue(
      context && context.id === id,
      'CONTEXT_REQUIRED',
      'Open Pargoo in this chat and confirm a connection first.',
    );

    return context;
  }

  async select(id: string, profileId: string, revision: string) {
    return this.store.lock(async () => {
      const context = await this.get(id);
      const profile = await this.profiles.get(profileId);
      requireValue(
        profile.revision === revision,
        'PROFILE_CHANGED',
        'The connection changed. Reload and confirm its current address.',
      );
      context.selection = {
        profileId,
        fingerprint: profileFingerprint(profile),
        confirmedAt: new Date().toISOString(),
      };
      await this.store.write(`context-${id}.json`, context);

      return {
        contextId: id,
        profile: publicProfile(profile),
        confirmedAt: context.selection.confirmedAt,
      };
    });
  }

  async require(id: string) {
    const context = await this.get(id);
    requireValue(
      context.selection,
      'CONFIRM_ENVIRONMENT',
      'Choose and confirm the project and environment in Pargoo.',
    );
    const profile = await this.profiles.get(context.selection.profileId);
    requireValue(
      context.selection.fingerprint === profileFingerprint(profile),
      'CONFIRM_ENVIRONMENT',
      'The connection changed. Confirm its current project, environment and CMS address again.',
    );

    return { context, profile };
  }
}
