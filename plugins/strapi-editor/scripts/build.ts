import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  access,
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'esbuild';
import { checkPackage, checkProject, output, root } from './check.ts';

assert(
  process.platform === 'darwin' && process.arch === 'arm64',
  'Build on macOS with Apple Silicon.',
);
const { manifest, nodeVersion } = await checkProject();
const versionPlugin: Plugin = {
  name: 'plugin-version',
  setup(builder) {
    builder.onLoad({ filter: /\/src\/shared\/version\.ts$/ }, ({ path }) => {
      if (path !== join(root, 'src/shared/version.ts')) {
        return;
      }

      return {
        contents: `export const VERSION = ${JSON.stringify(manifest.version)};`,
        loader: 'ts',
      };
    });
  },
};
const run = (command: string, args: string[]) => execFileSync(command, args, { stdio: 'inherit' });
const runtimeDirectory = join(root, 'src/server/runtime');
const runtimeSource = join(runtimeDirectory, 'node');
const runtimeInfo = await lstat(runtimeSource);
assert(
  runtimeInfo.isFile() && !runtimeInfo.isSymbolicLink(),
  'The bundled Node must be a regular file.',
);
assert(runtimeInfo.size < 100 * 1024 * 1024, 'The bundled Node exceeds the GitHub file limit.');
await access(join(runtimeDirectory, 'NODE-LICENSE'));
run('/usr/bin/codesign', ['--verify', '--strict', runtimeSource]);
const bundledNode = JSON.parse(
  execFileSync(
    runtimeSource,
    [
      '-p',
      'JSON.stringify({version:process.version,platform:process.platform,architecture:process.arch})',
    ],
    { encoding: 'utf8' },
  ),
) as { version: string; platform: string; architecture: string };
assert.deepEqual(
  bundledNode,
  { version: `v${nodeVersion}`, platform: 'darwin', architecture: 'arm64' },
  'The bundled Node must match .nvmrc and target Apple Silicon.',
);
// A sibling workspace keeps the final rename on the same filesystem as dist.
const temporary = await mkdtemp(join(root, '.build-'));
const stage = join(temporary, 'package');
// Keep the backup outside temporary so a failed rollback remains recoverable.
const previous = `${temporary}-previous`;

async function writeLicenses(inputs: string[]) {
  const packages = new Set<string>();

  for (const input of inputs) {
    if (!input.includes('node_modules/')) {
      continue;
    }

    let directory = dirname(resolve(root, input));
    let found = false;

    while (directory !== root && directory !== dirname(directory)) {
      try {
        const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));

        // Nested manifests can declare only an ESM module type, without package metadata.
        if (typeof metadata.name === 'string' && typeof metadata.version === 'string') {
          packages.add(directory);
          found = true;
          break;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      directory = dirname(directory);
    }

    assert(found, `Cannot identify the bundled dependency for ${input}.`);
  }

  const notices: string[] = [];

  for (const directory of [...packages].sort()) {
    const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as {
      name: string;
      version: string;
      license: string;
    };
    assert(
      metadata.name.trim() && metadata.version.trim(),
      `Invalid package metadata: ${directory}.`,
    );
    assert(
      typeof metadata.license === 'string' && metadata.license.trim(),
      `Missing license declaration for ${metadata.name}.`,
    );
    const parts = [`${metadata.name} ${metadata.version}`, `License: ${metadata.license}`];
    const files = (await readdir(directory)).filter((name) =>
      /^(licen[sc]e|copying|copyright|notice)([.\-_]|$)/i.test(name),
    );

    for (const file of files) {
      if ((await lstat(join(directory, file))).isFile()) {
        parts.push(await readFile(join(directory, file), 'utf8'));
      }
    }

    assert(
      parts.slice(2).some((text) => text.trim()),
      `Missing license text for ${metadata.name}.`,
    );

    notices.push(parts.join('\n\n'));
  }

  await mkdir(join(stage, 'licenses'));
  await writeFile(
    join(stage, 'licenses/THIRD-PARTY-NOTICES.txt'),
    notices.join('\n\n----------------------------------------\n\n') + '\n',
  );
  await cp(join(runtimeDirectory, 'NODE-LICENSE'), join(stage, 'licenses/NODE-LICENSE'));
}

try {
  await mkdir(stage, { recursive: true });

  for (const name of ['plugin.json', 'mcp.json', 'skills', 'assets']) {
    await cp(join(root, name), join(stage, name), { recursive: true });
  }

  const updater = await build({
    absWorkingDir: root,
    entryPoints: ['scripts/updater.ts'],
    outfile: join(stage, 'scripts/update-plugin.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    metafile: true,
  });

  const server = await build({
    absWorkingDir: root,
    plugins: [versionPlugin],
    entryPoints: ['src/server/index.ts'],
    outfile: join(stage, 'server/index.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    metafile: true,
    banner: {
      js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
    },
  });
  const panel = await build({
    absWorkingDir: root,
    plugins: [versionPlugin],
    entryPoints: ['src/client/main.tsx'],
    bundle: true,
    platform: 'browser',
    target: 'es2022',
    format: 'esm',
    jsx: 'automatic',
    loader: { '.svg': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"production"' },
    minify: true,
    write: false,
    metafile: true,
  });
  const styles = await readFile(join(root, 'src/client/styles.css'), 'utf8');

  for (const bundle of [server, panel]) {
    assert(!bundle.metafile.inputs['package.json'], 'Do not bundle development package metadata.');
  }

  const template = await readFile(join(root, 'src/client/editor.html'), 'utf8');
  const html = template
    .replace('/* APP_STYLE */', () => styles)
    .replace('/* APP_SCRIPT */', () =>
      panel.outputFiles[0].text.replaceAll('</script', '<\\/script'),
    );
  await mkdir(join(stage, 'ui'));
  await writeFile(join(stage, 'ui/editor.html'), html);

  await mkdir(join(stage, 'native'));
  const helper = join(stage, 'native/strapi-editor-helper');
  run('/usr/bin/xcrun', [
    'swiftc',
    '-O',
    '-target',
    'arm64-apple-macosx13.0',
    '-module-cache-path',
    join(temporary, 'swift'),
    '-framework',
    'AppKit',
    '-framework',
    'Security',
    join(root, 'src/server/native/StrapiEditorHelper.swift'),
    '-o',
    helper,
  ]);
  await chmod(helper, 0o755);

  await mkdir(join(stage, 'runtime'));
  const runtime = join(stage, 'runtime/node');
  await cp(runtimeSource, runtime);
  await chmod(runtime, 0o755);
  const identity = process.env.PARGOO_SIGNING_IDENTITY || '-';
  const signingOptions = identity === '-' ? [] : ['--options', 'runtime', '--timestamp'];
  run('/usr/bin/codesign', ['--force', '--sign', identity, ...signingOptions, helper]);

  if (identity !== '-') {
    run('/usr/bin/codesign', [
      '--force',
      '--sign',
      identity,
      '--preserve-metadata=entitlements',
      ...signingOptions,
      runtime,
    ]);
  }

  for (const file of [runtime, helper]) {
    run('/usr/bin/codesign', ['--verify', '--strict', file]);
  }

  assert.equal(
    execFileSync(runtime, ['--version'], { encoding: 'utf8' }).trim(),
    bundledNode.version,
  );
  const bytes = await readFile(runtime);
  await writeFile(
    join(stage, 'BUILD.json'),
    JSON.stringify(
      {
        version: manifest.version,
        node: bundledNode.version,
        platform: 'darwin',
        architecture: 'arm64',
        minimumMacOS: '13.0',
        builtAt: new Date().toISOString(),
        runtime: {
          symbolsStripped: true,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        },
        signing:
          identity === '-'
            ? 'Ad-hoc; Developer ID and notarization are not configured.'
            : `Developer ID: ${identity}; notarization is a separate step.`,
      },
      null,
      2,
    ) + '\n',
  );
  await writeLicenses([
    ...Object.keys(server.metafile.inputs),
    ...Object.keys(panel.metafile.inputs),
    ...Object.keys(updater.metafile.inputs),
  ]);
  const result = await checkPackage(stage);

  // Keep the last usable package until the new one passes every build check.
  const existing = await lstat(output).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  });

  if (existing) {
    assert(
      existing.isDirectory() && !existing.isSymbolicLink(),
      'dist must be a regular directory.',
    );
    await rename(output, previous);
  }

  try {
    await rename(stage, output);
  } catch (error) {
    if (existing) {
      await rename(previous, output);
    }

    throw error;
  }
  await rm(previous, { recursive: true, force: true });
  console.log(JSON.stringify({ ...result, directory: output }, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
