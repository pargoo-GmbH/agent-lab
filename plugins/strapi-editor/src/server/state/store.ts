import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, lstat, readFile, open, rename, unlink, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { Operation, StoredProfile } from '../types.ts';
import { errorCode, EditorError, requireValue } from '../errors.ts';

export const isId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
export const defaultDataDir = () =>
  process.env.STRAPI_EDITOR_DATA_DIR ||
  join(homedir(), 'Library', 'Application Support', 'Strapi Editor');

export class Store {
  directory: string;
  constructor(directory = defaultDataDir()) {
    this.directory = directory;
  }

  async initialize() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const info = await lstat(this.directory);
    requireValue(
      info.isDirectory() && !info.isSymbolicLink() && !(info.mode & 0o077),
      'PRIVATE_DIRECTORY_REQUIRED',
      'pargoo needs a private directory accessible only to your macOS account.',
    );
  }

  file(name: string) {
    requireValue(
      /^(profiles|projects|credential-cleanup|context-[a-f0-9-]+|operation-[a-f0-9-]+)\.json$/.test(
        name,
      ),
      'INVALID_RECORD',
      'Invalid local record.',
    );

    return join(this.directory, name);
  }

  async read<T>(name: string, fallback: T): Promise<T> {
    await this.initialize();
    try {
      const file = this.file(name);
      const info = await lstat(file);
      requireValue(
        info.isFile() && !info.isSymbolicLink() && !(info.mode & 0o077),
        'PRIVATE_FILE_REQUIRED',
        'A pargoo settings file has unsafe permissions.',
      );

      return JSON.parse(await readFile(file, 'utf8')) as T;
    } catch (error) {
      if (errorCode(error) === 'ENOENT') {
        return fallback;
      }

      if (error instanceof EditorError) {
        throw error;
      }

      throw new EditorError(
        'SETTINGS_UNREADABLE',
        'pargoo could not read its settings. Existing settings have been preserved.',
      );
    }
  }

  async write(name: string, value: unknown) {
    await this.initialize();
    const file = this.file(name);
    const temporary = `${file}.${randomUUID()}.tmp`;
    let handle;
    try {
      handle = await open(temporary, 'wx', 0o600);
      await handle.writeFile(JSON.stringify(value, null, 2) + '\n');
      await handle.sync();
      await handle.close();
      handle = null;
      await rename(temporary, file);
    } finally {
      if (handle) {
        await handle.close();
      }

      await unlink(temporary).catch(() => {});
    }
  }

  async lock<T>(task: () => Promise<T>): Promise<T> {
    requireValue(process.platform === 'darwin', 'MACOS_REQUIRED', 'pargoo requires macOS.');
    await this.initialize();
    const path = join(this.directory, 'settings.lock');
    // Darwin's O_EXLOCK (sys/fcntl.h) is not exported by Node's fs.constants.
    // O_NONBLOCK keeps contention out of libuv's worker pool while we retry.
    const flags = constants.O_RDWR | constants.O_CREAT | constants.O_NONBLOCK | 0x20;
    const deadline = Date.now() + 8000;
    let handle;

    while (!handle) {
      try {
        handle = await open(path, flags, 0o600);
      } catch (error) {
        if (!['EAGAIN', 'EWOULDBLOCK'].includes(errorCode(error) ?? '')) {
          throw new EditorError('SETTINGS_LOCKED', 'Could not lock the local settings.');
        }

        if (Date.now() > deadline) {
          throw new EditorError(
            'SETTINGS_BUSY',
            'Another pargoo window is saving settings. Please try again.',
          );
        }

        await delay(40);
      }
    }

    try {
      return await task();
    } finally {
      // Keep the inode: unlinking could let a second process bypass an existing lock.
      // Closing the descriptor (including process exit) releases the kernel lock.
      await handle.close();
    }
  }

  async profiles() {
    const data = await this.read<{ version: number; profiles: StoredProfile[] }>('profiles.json', {
      version: 1,
      profiles: [],
    });
    requireValue(
      data.version === 1 &&
        Array.isArray(data.profiles) &&
        data.profiles.every((p) => isId(p.id) && isId(p.revision)),
      'SETTINGS_VERSION',
      'This settings format is unsupported. Update pargoo; existing settings have been preserved.',
    );

    return data.profiles;
  }

  async pendingOperations(contextId: string) {
    await this.initialize();
    const operations: Operation[] = [];

    for (const name of await readdir(this.directory)) {
      if (!/^operation-[a-f0-9-]+\.json$/.test(name)) {
        continue;
      }

      const operation = await this.read<Operation | null>(name, null);

      if (
        operation?.input.contextId === contextId &&
        operation.state === 'awaiting_confirmation' &&
        operation.needsApproval
      ) {
        operations.push(operation);
      }
    }

    return operations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
