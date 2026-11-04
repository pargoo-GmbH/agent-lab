import type { Store } from './store.ts';
import type { Project } from '../../shared/types.ts';
import { createHash, randomUUID } from 'node:crypto';
import { requireValue } from '../errors.ts';
import { isId } from './store.ts';

const validName = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.trim().length <= 100 &&
  !/[\x00-\x1f]/.test(value);

// Existing profile documents remain untouched. A deterministic identity keeps
// inferred projects stable until an explicit project document is saved.
function legacyId(name: string) {
  const bytes = createHash('sha256')
    .update('pargoo-project:')
    .update(name)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class Projects {
  store: Store;
  constructor(store: Store) {
    this.store = store;
  }

  async list() {
    const saved = await this.store.read<{ version: number; projects: Project[] }>('projects.json', {
      version: 1,
      projects: [],
    });
    requireValue(
      saved?.version === 1 &&
        Array.isArray(saved.projects) &&
        saved.projects.every(
          (project) =>
            project &&
            isId(project.id) &&
            validName(project.name) &&
            project.name === project.name.trim(),
        ),
      'SETTINGS_VERSION',
      'The project settings format is unsupported. Existing settings have been preserved.',
    );
    const projects = saved.projects.map(({ id, name }) => ({ id, name }));
    requireValue(
      new Set(projects.map((project) => project.id)).size === projects.length &&
        new Set(projects.map((project) => project.name)).size === projects.length,
      'SETTINGS_VERSION',
      'The project settings contain duplicate identities. Existing settings have been preserved.',
    );

    for (const profile of await this.store.profiles()) {
      requireValue(
        validName(profile.project) && profile.project === profile.project.trim(),
        'PROFILE_INVALID',
        'A saved environment has an invalid project name. Existing settings have been preserved.',
      );

      if (!projects.some((project) => project.name === profile.project)) {
        projects.push({ id: legacyId(profile.project), name: profile.project });
      }
    }

    requireValue(
      new Set(projects.map((project) => project.id)).size === projects.length,
      'SETTINGS_VERSION',
      'The project settings contain conflicting identities. Existing settings have been preserved.',
    );

    return projects;
  }

  async get(id: string) {
    const project = (await this.list()).find((project) => project.id === id);
    requireValue(
      project,
      'PROJECT_NOT_FOUND',
      'This project no longer exists. Choose a project before adding an environment.',
    );

    return project;
  }

  async create(input: { name: string }) {
    requireValue(
      input && validName(input.name),
      'PROJECT_INVALID',
      'Enter a project name with 1–100 characters.',
    );
    const name = input.name.trim();

    return this.store.lock(async () => {
      const projects = await this.list();
      requireValue(
        !projects.some((project) => project.name.toLowerCase() === name.toLowerCase()),
        'PROJECT_DUPLICATE',
        'A project with this name already exists.',
      );
      const project = { id: randomUUID(), name };
      await this.store.write('projects.json', { version: 1, projects: [...projects, project] });

      return project;
    });
  }

  async retain() {
    return this.store.lock(async () => {
      await this.store.write('projects.json', { version: 1, projects: await this.list() });
    });
  }

  async remove(id: string) {
    return this.store.lock(async () => {
      const project = await this.get(id);
      requireValue(
        !(await this.store.profiles()).some((profile) => profile.project === project.name),
        'PROJECT_NOT_EMPTY',
        'Remove this project’s environments in their settings before removing the project.',
      );
      await this.store.write('projects.json', {
        version: 1,
        projects: (await this.list()).filter((item) => item.id !== id),
      });
    });
  }
}
