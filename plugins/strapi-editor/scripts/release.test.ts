import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishPackage } from './release.ts';
import { root } from './check.ts';
import { check, resolveConfig } from 'prettier';

const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

test('version:set keeps all version fields synchronized and passes Prettier without manual formatting', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pargoo-version-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'scripts'));

  for (const file of [
    'package.json',
    'package-lock.json',
    'plugin.json',
    '.nvmrc',
    '.prettierrc.json',
    '.prettierignore',
    'scripts/check.ts',
    'scripts/release.ts',
  ]) {
    await cp(join(root, file), join(directory, file));
  }

  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
  execFileSync('npm', ['--prefix', directory, 'run', 'version:set', '--', '9.8.7'], {
    cwd: directory,
  });
  const read = async (name) => JSON.parse(await readFile(join(directory, name), 'utf8'));
  assert.equal((await read('package.json')).version, '9.8.7');
  assert.equal((await read('plugin.json')).version, '9.8.7');
  const lock = await read('package-lock.json');
  assert.equal(lock.version, '9.8.7');
  assert.equal(lock.packages[''].version, '9.8.7');

  for (const name of ['package.json', 'plugin.json']) {
    const file = join(directory, name);
    assert(
      await check(await readFile(file, 'utf8'), { ...(await resolveConfig(file)), filepath: file }),
      name + ' must already satisfy Prettier.',
    );
  }
});

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'pargoo-release-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repositoryRoot = join(directory, 'source');
  const remote = join(directory, 'origin.git');
  const packageDirectory = join(directory, 'bundle');
  await mkdir(repositoryRoot);
  await mkdir(packageDirectory);
  git(repositoryRoot, 'init', '-b', 'main');
  git(repositoryRoot, 'config', 'user.name', 'Release test');
  git(repositoryRoot, 'config', 'user.email', 'release@example.invalid');
  await writeFile(join(repositoryRoot, 'README.md'), 'Source remains on main.\n');
  git(repositoryRoot, 'add', '.');
  git(repositoryRoot, 'commit', '-m', 'Fixture source');
  git(directory, 'clone', '--bare', repositoryRoot, remote);
  git(repositoryRoot, 'remote', 'add', 'origin', remote);
  const setVersion = (version) =>
    writeFile(
      join(packageDirectory, 'plugin.json'),
      JSON.stringify({ name: 'strapi-editor', version }),
    );
  await setVersion('1.0.0');
  await writeFile(join(packageDirectory, 'helper'), '#!/bin/sh\nexit 0\n');
  await chmod(join(packageDirectory, 'helper'), 0o755);

  return { repositoryRoot, packageDirectory, remote, directory, setVersion };
}

test('release creates stable without source files and preserves main and executable modes', async (t) => {
  const options = await fixture(t);
  const source = git(options.repositoryRoot, 'rev-parse', 'HEAD');
  const result = await publishPackage(options);
  assert.equal(result.status, 'published');
  assert.equal(git(options.remote, 'rev-parse', 'main'), source);
  assert.equal(git(options.repositoryRoot, 'branch', '--show-current'), 'main');
  assert.equal(git(options.repositoryRoot, 'status', '--porcelain'), '');
  assert.equal(git(options.remote, 'ls-tree', '--name-only', 'stable'), 'packages');
  assert.equal(
    JSON.parse(git(options.remote, 'show', 'stable:packages/strapi-editor/plugin.json')).version,
    '1.0.0',
  );
  assert.match(
    git(options.remote, 'ls-tree', 'stable', 'packages/strapi-editor/helper'),
    /^100755 /,
  );
});

test('release preserves other packages, previews without pushing, and refuses repeated or older versions', async (t) => {
  const options = await fixture(t);
  await publishPackage(options);
  const other = join(options.directory, 'other-publisher');
  git(options.directory, 'clone', '--branch', 'stable', options.remote, other);
  git(other, 'config', 'user.name', 'Other plugin');
  git(other, 'config', 'user.email', 'other@example.invalid');
  await mkdir(join(other, 'packages/another-plugin'));
  await writeFile(join(other, 'packages/another-plugin/keep.txt'), 'preserve this package');
  git(other, 'add', '.');
  git(other, 'commit', '-m', 'Another plugin');
  git(other, 'push', 'origin', 'stable');
  const previous = git(options.remote, 'rev-parse', 'stable');
  await options.setVersion('1.1.0');
  assert.equal((await publishPackage({ ...options, dryRun: true })).status, 'dry_run');
  assert.equal(git(options.remote, 'rev-parse', 'stable'), previous);
  assert.equal((await publishPackage(options)).previousVersion, '1.0.0');
  assert.equal(
    git(options.remote, 'show', 'stable:packages/another-plugin/keep.txt'),
    'preserve this package',
  );
  const released = git(options.remote, 'rev-parse', 'stable');

  for (const version of ['1.1.0', '0.9.0']) {
    await options.setVersion(version);
    await assert.rejects(publishPackage(options), /not newer than stable/);
    assert.equal(git(options.remote, 'rev-parse', 'stable'), released);
  }
});

test('a rejected release push leaves the published package intact', async (t) => {
  const options = await fixture(t);
  await publishPackage(options);
  const previous = git(options.remote, 'rev-parse', 'stable');
  const hook = join(options.remote, 'hooks/pre-receive');
  await writeFile(hook, '#!/bin/sh\nexit 1\n');
  await chmod(hook, 0o755);
  await options.setVersion('1.1.0');
  await assert.rejects(publishPackage(options), /git .*push/);
  assert.equal(git(options.remote, 'rev-parse', 'stable'), previous);
  assert.equal(
    JSON.parse(git(options.remote, 'show', 'stable:packages/strapi-editor/plugin.json')).version,
    '1.0.0',
  );
  assert.equal(
    JSON.parse(await readFile(join(options.packageDirectory, 'plugin.json'), 'utf8')).version,
    '1.1.0',
  );
});
