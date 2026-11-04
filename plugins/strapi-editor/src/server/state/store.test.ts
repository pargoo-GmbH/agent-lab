import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Store } from './store.ts';

test(
  'a crashed settings writer releases its lock without allowing overlapping writes',
  { timeout: 5000 },
  async (t) => {
    const directory = await fs.mkdtemp(join(tmpdir(), 'pargoo-lock-test-'));
    const child = spawn(process.execPath, [
      '--input-type=module',
      '-e',
      `import { Store } from ${JSON.stringify(new URL('./store.ts', import.meta.url).href)};
     await new Store(${JSON.stringify(directory)}).lock(async () => {
       process.stdout.write('locked');
       setInterval(() => {}, 1000);
       await new Promise(() => {});
     });`,
    ]);
    const exited = once(child, 'exit');
    t.after(() => child.kill('SIGKILL'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    assert.equal(String((await once(child.stdout, 'data'))[0]), 'locked');
    const store = new Store(directory);
    let entered = false;
    const next = store.lock(async () => {
      entered = true;

      return 'saved';
    });
    await delay(100);
    assert.equal(entered, false);
    child.kill('SIGKILL');
    await exited;
    assert.equal(await next, 'saved');
  },
);

test('abandoned incomplete locks recover without allowing concurrent settings writes', async (t) => {
  const directory = await fs.mkdtemp(join(tmpdir(), 'pargoo-lock-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = new Store(directory);
  const lock = join(directory, 'settings.lock');

  for (const contents of ['', '{"pid":']) {
    await fs.writeFile(lock, contents, { mode: 0o600 });
    const abandoned = new Date(Date.now() - 60_000);
    await fs.utimes(lock, abandoned, abandoned);
    let active = 0;
    const saved = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        store.lock(async () => {
          active++;
          assert.equal(active, 1);
          await delay(10);
          active--;

          return index;
        }),
      ),
    );
    assert.deepEqual(saved, [0, 1, 2, 3]);
    assert.deepEqual(await fs.readdir(directory), ['settings.lock']);
  }
});
