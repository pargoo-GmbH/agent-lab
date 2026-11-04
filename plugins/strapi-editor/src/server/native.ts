import type { Fields } from './types.ts';
type NativeResult = {
  ok?: boolean;
  code?: string;
  value?: string;
  path?: string;
  name?: string;
  cancelled?: boolean;
};
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { EditorError, requireValue } from './errors.ts';

export class Native {
  path: string;
  knownSecrets: Set<string>;
  constructor(
    path = process.env.STRAPI_EDITOR_NATIVE_HELPER ||
      fileURLToPath(new URL('../native/strapi-editor-helper', import.meta.url)),
  ) {
    this.path = path;
    this.knownSecrets = new Set<string>();
  }

  async request(request: Fields): Promise<NativeResult> {
    requireValue(
      process.platform === 'darwin',
      'MACOS_REQUIRED',
      'This version of Pargoo supports macOS.',
    );

    return new Promise<NativeResult>((resolve, reject) => {
      const child = spawn(this.path, [], { stdio: ['pipe', 'pipe', 'ignore'] });
      const chunks: Buffer[] = [];
      let size = 0;
      const timer = setTimeout(() => {
        child.kill();
        reject(new EditorError('NATIVE_TIMEOUT', 'The macOS dialog timed out. Please try again.'));
      }, 180_000);
      child.on('error', () => {
        clearTimeout(timer);
        reject(
          new EditorError(
            'NATIVE_UNAVAILABLE',
            'The macOS helper could not start. Rebuild or reinstall the matching macOS plugin package.',
          ),
        );
      });
      child.stdout.on('data', (chunk) => {
        size += chunk.length;

        if (size > 131072) {
          child.kill();
        } else {
          chunks.push(chunk);
        }
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        let result: NativeResult | undefined;
        try {
          result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {}

        if (result?.code === 'CANCELLED') {
          return resolve({ cancelled: true });
        }

        if (code !== 0 || !result?.ok) {
          return reject(
            new EditorError(
              'KEYCHAIN_UNAVAILABLE',
              'macOS could not access the Pargoo credential. Allow access in the macOS dialog or reconnect this profile.',
            ),
          );
        }

        resolve(result);
      });
      child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify(request));
    });
  }

  async set(key: string, value: string) {
    this.knownSecrets.add(value);
    await this.request({ action: 'set', key, value });
  }

  async get(key: string) {
    const result = await this.request({ action: 'get', key });
    requireValue(
      typeof result.value === 'string',
      'KEYCHAIN_UNAVAILABLE',
      'The saved credential is unavailable. Reconnect this profile.',
    );
    this.knownSecrets.add(result.value);

    return result.value;
  }

  async delete(key: string) {
    await this.request({ action: 'delete', key });
  }

  async chooseFile() {
    return this.request({ action: 'chooseFile' });
  }

  redact<T>(value: T): T {
    if (typeof value === 'string') {
      let redacted: string = value;

      for (const secret of this.knownSecrets) {
        if (secret) {
          redacted = redacted.split(secret).join('[redacted]');
        }
      }

      return redacted as T;
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.redact(v)) as T;
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.redact(v)])) as T;
    }

    return value as T;
  }
}
