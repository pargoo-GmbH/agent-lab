import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { format, getFileInfo, resolveConfig } from 'prettier';
import { checkPackage, output, readProject, root } from './check.ts';

const packagePath = 'packages/strapi-editor';
const repository = 'pargoo-gmbh/agent-lab';
const normalizeRepository = (value: string) =>
  value
    .replace(/^https:\/\/github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\.git\/?$/, '')
    .replace(/\/$/, '')
    .toLowerCase();
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

type PublishOptions = { repositoryRoot: string; packageDirectory: string; dryRun?: boolean };

// Exported separately from the build so publication can be exercised against a
// disposable bare repository without touching the real origin or developer tree.
export async function publishPackage({
  repositoryRoot,
  packageDirectory,
  dryRun = false,
}: PublishOptions) {
  const manifest = JSON.parse(await readFile(join(packageDirectory, 'plugin.json'), 'utf8')) as {
    name: string;
    version: string;
  };
  assert.equal(manifest.name, 'strapi-editor');
  assert.match(manifest.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  const sourceCommit = git(repositoryRoot, 'rev-parse', 'HEAD');
  const remote = git(repositoryRoot, 'remote', 'get-url', '--push', 'origin');
  const reference = git(repositoryRoot, 'ls-remote', remote, 'refs/heads/stable').split(/\s/)[0];
  const directory = await mkdtemp(join(tmpdir(), 'pargoo-release-'));
  try {
    git(directory, 'init', '-b', 'stable');
    git(directory, 'remote', 'add', 'origin', remote);

    if (reference) {
      git(directory, 'fetch', '--depth=1', 'origin', 'refs/heads/stable');
      git(directory, 'checkout', '-B', 'stable', 'FETCH_HEAD');
    }

    let previousVersion: string | null = null;
    const target = join(directory, packagePath);
    try {
      const previous = JSON.parse(await readFile(join(target, 'plugin.json'), 'utf8')) as {
        name: string;
        version: string;
      };
      assert.equal(previous.name, manifest.name, 'The stable package has a different identity.');
      assert.match(previous.version, /^\d+\.\d+\.\d+$/);
      previousVersion = previous.version;
      const next = manifest.version.split('.').map(Number);
      const old = previous.version.split('.').map(Number);
      const difference =
        next.map((part, index) => part - old[index]).find((value) => value !== 0) ?? 0;
      assert(
        difference > 0,
        `Version ${manifest.version} is not newer than stable ${previous.version}. Run npm run version:set -- <new-version>.`,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    await rm(target, { recursive: true, force: true });
    await mkdir(join(directory, 'packages'), { recursive: true });
    await cp(packageDirectory, target, { recursive: true });
    git(directory, 'add', '--force', '--', packagePath);
    const changes = git(directory, 'diff', '--cached', '--stat');

    if (!dryRun) {
      for (const field of ['user.name', 'user.email']) {
        git(directory, 'config', field, git(repositoryRoot, 'config', field));
      }

      git(
        directory,
        'commit',
        '-m',
        `Release strapi-editor ${manifest.version}`,
        '-m',
        `Source: ${sourceCommit}`,
      );
      // A concurrent publisher causes an ordinary non-fast-forward rejection.
      // Never force-push or rewrite existing releases.
      git(directory, 'push', 'origin', 'HEAD:refs/heads/stable');
    }

    return {
      status: dryRun ? 'dry_run' : 'published',
      version: manifest.version,
      previousVersion,
      sourceCommit,
      branch: 'stable',
      path: packagePath,
      changes,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function release() {
  const args = process.argv.slice(2);

  if (args[0] === '--version') {
    assert.equal(args.length, 2, 'Usage: npm run version:set -- <x.y.z>');
    const version = args[1];
    assert.match(
      version,
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
      'Use a stable x.y.z version.',
    );
    const { pkg, manifest, lock } = await readProject();
    assert.equal(pkg.name, manifest.name);
    assert.equal(pkg.name, lock.name);
    pkg.version = manifest.version = lock.version = lock.packages[''].version = version;

    for (const [name, value] of [
      ['package.json', pkg],
      ['plugin.json', manifest],
      ['package-lock.json', lock],
    ] as const) {
      const file = join(root, name);
      const json = JSON.stringify(value, null, 2) + '\n';
      const { ignored } = await getFileInfo(file, { ignorePath: join(root, '.prettierignore') });
      const content = ignored
        ? json
        : await format(json, { ...(await resolveConfig(file)), filepath: file });
      await writeFile(file, content);
    }

    console.log(`Version set to ${version}. Rebuild before installation.`);

    return;
  }

  if (args.length === 1 && args[0] === '--help') {
    console.log(
      'npm run release -- [--dry-run]\nBuild and verify, then publish packages/strapi-editor to origin/stable.\n--dry-run builds and previews the package without a commit or push.',
    );

    return;
  }

  assert(
    args.length === 0 || (args.length === 1 && args[0] === '--dry-run'),
    'Only --dry-run or --help is supported.',
  );
  const dryRun = args.includes('--dry-run');
  const repositoryRoot = git(root, 'rev-parse', '--show-toplevel');
  const sourceCommit = git(repositoryRoot, 'rev-parse', 'HEAD');

  for (const args of [
    ['remote', 'get-url', 'origin'],
    ['remote', 'get-url', '--push', 'origin'],
  ]) {
    assert.equal(
      normalizeRepository(git(repositoryRoot, ...args)),
      repository,
      'origin must point to pargoo-GmbH/agent-lab.',
    );
  }

  if (!dryRun) {
    assert.equal(
      git(repositoryRoot, 'branch', '--show-current'),
      'main',
      'Publish from main after the reviewed source has been merged.',
    );
    assert.equal(
      git(repositoryRoot, 'status', '--porcelain'),
      '',
      'Commit the reviewed source first. The release script only commits the stable package.',
    );
    const publishedMain = git(repositoryRoot, 'ls-remote', 'origin', 'refs/heads/main').split(
      /\s/,
    )[0];
    assert.equal(
      git(repositoryRoot, 'rev-parse', 'HEAD'),
      publishedMain,
      'Local main must match origin/main. Publish the reviewed source separately first.',
    );
  }

  execFileSync('npm', ['run', 'verify'], { cwd: root, stdio: 'inherit' });
  await checkPackage(output);

  if (!dryRun) {
    assert.equal(
      git(repositoryRoot, 'rev-parse', 'HEAD'),
      sourceCommit,
      'The source commit changed during the build. Review it and release again.',
    );
    assert.equal(
      git(repositoryRoot, 'status', '--porcelain'),
      '',
      'The source changed during the build. Review it and release again.',
    );
  }

  console.log(
    JSON.stringify(
      await publishPackage({ repositoryRoot, packageDirectory: output, dryRun }),
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  release().catch((error) => {
    console.error(`pargoo release failed: ${error.message}`);
    process.exitCode = 1;
  });
}
