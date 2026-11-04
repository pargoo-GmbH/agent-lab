import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, lstat, readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'yaml';

type Package = typeof import('../package.json');
type Manifest = typeof import('../plugin.json');
type Lockfile = typeof import('../package-lock.json');
type McpConfig = typeof import('../mcp.json');

export const root = fileURLToPath(new URL('..', import.meta.url));
export const output = join(root, 'dist');
export const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8'));

export async function readProject() {
  const [pkg, manifest, lock, nodeVersion] = await Promise.all([
    readJson<Package>(join(root, 'package.json')),
    readJson<Manifest>(join(root, 'plugin.json')),
    readJson<Lockfile>(join(root, 'package-lock.json')),
    readFile(join(root, '.nvmrc'), 'utf8').then((value) => value.trim()),
  ]);

  return { pkg, manifest, lock, nodeVersion };
}

export async function checkProject() {
  const project = await readProject();
  const { pkg, manifest, lock, nodeVersion } = project;
  assert.equal(process.versions.node, nodeVersion, `Use Node.js ${nodeVersion} from .nvmrc.`);
  assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  assert.equal(manifest.name, pkg.name);
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages[''].name, pkg.name);

  for (const version of [manifest.version, lock.version, lock.packages[''].version]) {
    assert.equal(version, pkg.version, 'Versions differ. Run npm run version:set -- <x.y.z>.');
  }

  assert.equal(pkg.engines.node, nodeVersion);
  assert.equal(lock.packages[''].engines.node, nodeVersion);

  return project;
}

export async function readRegistration(directory: string) {
  const manifest = await readJson<Manifest>(join(directory, 'plugin.json'));
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(manifest.name, 'strapi-editor');
  assert(manifest.author.name.trim());
  const extension = manifest.extensions['com.openai'];
  assert.equal(extension.requires_local_executor, true);
  const listing = extension.interface;
  const limits = {
    displayName: 30,
    shortDescription: 30,
    longDescription: 4000,
    developerName: 80,
    category: 120,
    logo: 2048,
    composerIcon: 2048,
  };

  for (const field of Object.keys(limits) as (keyof typeof limits)[]) {
    assert(
      typeof listing[field] === 'string' && listing[field].trim(),
      `Missing interface.${field}.`,
    );
    assert(
      listing[field].length <= limits[field],
      `interface.${field} exceeds ${limits[field]} characters.`,
    );
  }

  assert(
    Array.isArray(listing.capabilities) &&
      listing.capabilities.every((value) => typeof value === 'string' && value.trim()),
  );
  const mcp = await readJson<McpConfig>(join(directory, 'mcp.json'));
  assert.equal(mcp.$schema, 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
  assert.deepEqual(Object.keys(mcp.mcpServers), ['strapi-editor']);
  const server = mcp.mcpServers['strapi-editor'];
  assert.equal(server.type, 'stdio');
  // The portable Codex loader resolves this contained executable path.
  assert.equal(server.command, './runtime/node');
  assert.deepEqual(server.args, ['${PLUGIN_ROOT}/server/index.mjs']);
  assert.equal(server.cwd, '${PLUGIN_ROOT}');

  return { manifest, mcp, server };
}

export async function checkPackage(directory = output) {
  const { manifest, nodeVersion } = await checkProject();
  const registration = await readRegistration(directory);
  assert.deepEqual(registration.manifest, manifest);
  assert.deepEqual(registration.mcp, await readJson<McpConfig>(join(root, 'mcp.json')));
  const expected = [
    'BUILD.json',
    'assets',
    'licenses',
    'mcp.json',
    'native',
    'plugin.json',
    'runtime',
    'scripts',
    'server',
    'skills',
    'ui',
  ];
  assert.deepEqual(
    (await readdir(directory)).sort(),
    expected.sort(),
    'Unexpected files in the installable package.',
  );

  for (const file of [
    'server/index.mjs',
    'ui/editor.html',
    'scripts/update-plugin.mjs',
    'licenses/NODE-LICENSE',
  ]) {
    await access(join(directory, file));
  }

  for (const file of ['runtime/node', 'native/strapi-editor-helper']) {
    assert((await lstat(join(directory, file))).mode & 0o100, `${file} must be executable.`);
  }

  const extension = manifest.extensions['com.openai'];

  for (const file of [
    extension.onboardingSkill,
    extension.interface.logo,
    extension.interface.composerIcon,
  ]) {
    await access(join(directory, file));
  }

  const skills = await readdir(join(root, 'skills'));
  assert.deepEqual((await readdir(join(directory, 'skills'))).sort(), skills.sort());

  for (const name of skills) {
    const source = await readFile(join(directory, 'skills', name, 'SKILL.md'), 'utf8');
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/);
    assert(frontmatter, `${name}: missing skill metadata.`);
    const metadata = parse(frontmatter[1]) as { name: string; description: string };
    assert.equal(metadata.name, name);
    assert(metadata.description.trim());
  }

  const build = await readJson<{
    version: string;
    node: string;
    platform: string;
    architecture: string;
    runtime: { symbolsStripped: boolean; bytes: number; sha256: string };
  }>(join(directory, 'BUILD.json'));
  assert.equal(build.version, manifest.version);
  assert.equal(build.node, `v${nodeVersion}`);
  assert.equal(build.platform, 'darwin');
  assert.equal(build.architecture, 'arm64');
  assert.equal(build.runtime.symbolsStripped, true);
  const runtime = await readFile(join(directory, 'runtime/node'));
  assert.equal(runtime.length, build.runtime.bytes);
  assert.equal(createHash('sha256').update(runtime).digest('hex'), build.runtime.sha256);
  const files: string[] = [];
  const scan = async (path: string): Promise<void> => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      assert(!entry.isSymbolicLink(), `Package contains a symlink: ${child}`);

      if (entry.isDirectory()) {
        await scan(child);
      } else {
        assert(entry.isFile(), `Package contains a non-regular file: ${child}`);
        files.push(relative(directory, child));
        assert(
          (await lstat(child)).size < 100 * 1024 * 1024,
          `GitHub file limit exceeded: ${child}`,
        );
      }
    }
  };
  await scan(directory);
  assert.deepEqual(
    files.sort(),
    [
      'BUILD.json',
      'mcp.json',
      'plugin.json',
      'licenses/NODE-LICENSE',
      'licenses/THIRD-PARTY-NOTICES.txt',
      'native/strapi-editor-helper',
      'runtime/node',
      'scripts/update-plugin.mjs',
      'server/index.mjs',
      'ui/editor.html',
      ...new Set(
        [extension.interface.logo, extension.interface.composerIcon].map((file) =>
          file.replace(/^\.\//, ''),
        ),
      ),
      ...skills.map((name) => `skills/${name}/SKILL.md`),
    ].sort(),
    'Unexpected or missing files inside the installable package.',
  );
  const html = await readFile(join(directory, 'ui/editor.html'), 'utf8');
  assert(
    !html.includes('/* APP_SCRIPT */') && !html.includes('/* APP_STYLE */'),
    'The panel must be compiled.',
  );

  return {
    version: manifest.version,
    skills: skills.length,
    runtimeMiB: Number((runtime.length / 1024 / 1024).toFixed(2)),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === '--desktop') {
    const { checkDesktop } = await import('./dev/check-desktop.ts');
    await checkDesktop(readRegistration);
  } else {
    console.log(JSON.stringify(await checkPackage(), null, 2));
  }
}
