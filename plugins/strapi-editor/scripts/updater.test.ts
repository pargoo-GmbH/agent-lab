import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkInstalled, updatePlugin } from './updater.ts';
import { VERSION } from '../src/shared/version.ts';

function fixture({
  current = '0.2.4',
  latest = '0.2.5',
  source = 'https://github.com/pargoo-GmbH/agent-lab.git',
  errors = [],
  enabled = true,
} = {}) {
  const calls = [];
  let refreshed = false;
  const options = {
    binary: 'fixture-codex',
    installationRoot: `/cache/pargoo-agent-lab/strapi-editor/${current}`,
    run(binary, args) {
      assert.equal(binary, 'fixture-codex');
      assert.equal(args[0], 'plugin');
      assert.equal(args.at(-1), '--json');
      const command = args.slice(1, -1);
      calls.push(command);

      if (command.join(' ') === 'marketplace list') {
        return JSON.stringify({
          marketplaces: [
            {
              name: 'pargoo-agent-lab',
              root: '/snapshot',
              marketplaceSource: { sourceType: 'git', source },
            },
          ],
        });
      }

      if (command.join(' ') === 'list --marketplace pargoo-agent-lab') {
        return JSON.stringify({
          installed: [
            {
              pluginId: 'strapi-editor@pargoo-agent-lab',
              version: refreshed ? latest : current,
              enabled,
            },
          ],
        });
      }

      if (command.join(' ') === 'marketplace upgrade pargoo-agent-lab') {
        refreshed = true;

        return JSON.stringify({ errors });
      }

      throw new Error(`Unexpected CLI mutation: ${command}`);
    },
    async read(path) {
      assert.equal(path, '/snapshot/.agents/plugins/marketplace.json');

      return JSON.stringify({
        name: 'pargoo-agent-lab',
        plugins: [
          {
            name: 'strapi-editor',
            source: {
              source: 'git-subdir',
              url: source,
              ref: 'stable',
              path: './packages/strapi-editor',
            },
          },
        ],
      });
    },
    async check(path, version) {
      assert.equal(path, `/cache/pargoo-agent-lab/strapi-editor/${latest}`);
      assert.equal(version, latest);

      return { toolCount: 10 };
    },
  };

  return { options, calls };
}

test('updater uses the native marketplace upgrade and verifies its installed version', async () => {
  const { options, calls } = fixture();
  const result = await updatePlugin(options);
  assert.equal(result.status, 'updated');
  assert.equal(result.previousVersion, '0.2.4');
  assert.equal(result.version, '0.2.5');
  assert.equal(result.toolCount, 10);
  assert.equal(result.restartRequired, true);
  assert.deepEqual(
    calls.filter((command) => command[1] === 'upgrade'),
    [['marketplace', 'upgrade', 'pargoo-agent-lab']],
  );
  assert(!calls.some((command) => command[0] === 'add'));
});

test('updater reports an unchanged installed version without an extra install', async () => {
  const { options, calls } = fixture({ current: '0.2.5' });
  options.check = () =>
    assert.fail('An unchanged installation should not be probed as a new update.');
  const result = await updatePlugin(options);
  assert.equal(result.status, 'up_to_date');
  assert.equal(result.restartRequired, false);
  assert(!calls.some((command) => command[0] === 'add'));
});

test('updater refuses unrelated sources and disabled plugins before refreshing', async () => {
  for (const [settings, expected] of [
    [{ source: 'https://github.com/other/repo' }, /different repository/],
    [{ enabled: false }, /disabled/],
  ]) {
    const { options, calls } = fixture(settings);
    await assert.rejects(updatePlugin(options), expected);
    assert(!calls.some((command) => command[1] === 'upgrade'));
  }

  const { options, calls } = fixture();
  options.read = async () =>
    JSON.stringify({
      plugins: [
        {
          name: 'strapi-editor',
          source: {
            source: 'git-subdir',
            url: 'https://github.com/other/repo',
            ref: 'stable',
            path: './packages/strapi-editor',
          },
        },
      ],
    });
  await assert.rejects(updatePlugin(options), /different repository/);
  assert(!calls.some((command) => command[1] === 'upgrade'));
});

test('updater reports partial refresh failures and an unexpected installed downgrade', async () => {
  for (const [settings, expected] of [
    [{ errors: ['fixture refresh failure'] }, /Some updates may already have been applied/],
    [{ current: '9.0.0' }, /Codex installed an older release/],
  ]) {
    const { options } = fixture(settings);
    await assert.rejects(updatePlugin(options), expected);
  }
});

test('updater requires a fresh chat when its installed package is already outdated', async () => {
  const { options, calls } = fixture();
  options.installationRoot = '/cache/pargoo-agent-lab/strapi-editor/0.2.3';
  await assert.rejects(updatePlugin(options), /Open a new chat/);
  assert(!calls.some((command) => command[1] === 'upgrade'));
});

test('updater reports a failed startup check after installation instead of claiming success', async () => {
  const { options, calls } = fixture();
  options.check = async () => {
    throw new Error('fixture startup failure');
  };
  await assert.rejects(updatePlugin(options), /startup failure/);
  assert(calls.some((command) => command[1] === 'upgrade'));
});

test('updater startup probe reads the actual built MCP and UI without system Node', async () => {
  const root = resolve(process.env.STRAPI_EDITOR_PACKAGE_DIR ?? 'dist');
  await access(resolve(root, 'runtime/node'));
  assert.equal((await checkInstalled(root, VERSION)).toolCount, 10);
});
