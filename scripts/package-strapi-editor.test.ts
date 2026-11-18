import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildPackage } from "./package-strapi-editor.ts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "strapi-editor-package-test-"));
  await mkdir(join(root, "scripts"));
  await cp(
    join(repositoryRoot, "scripts", "strapi-editor.plugin.json"),
    join(root, "scripts", "strapi-editor.plugin.json"),
  );
  await cp(
    join(repositoryRoot, "skills", "strapi-editor"),
    join(root, "skills", "strapi-editor"),
    { recursive: true },
  );

  return root;
}

function unzip(args: string[]): Buffer {
  const result = spawnSync("unzip", args);
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr.toString());

  return result.stdout;
}

test("the customer ZIP has one portable plugin and byte-identical source files", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = await buildPackage(root);
  const files = unzip(["-Z1", archive]).toString().trim().split("\n");
  assert.deepEqual(files, [
    "README.md",
    "plugin.json",
    "skills/strapi-editor/SKILL.md",
  ]);

  for (const [source, destination] of [
    ["scripts/strapi-editor.plugin.json", "plugin.json"],
    ["skills/strapi-editor/README.md", "README.md"],
    ["skills/strapi-editor/SKILL.md", "skills/strapi-editor/SKILL.md"],
  ]) {
    assert.deepEqual(
      unzip(["-p", archive, destination]),
      await readFile(join(root, source)),
    );
  }

  const manifest = JSON.parse(unzip(["-p", archive, "plugin.json"]).toString());
  assert.equal(manifest.name, "pargoo-strapi-editor");
  assert.equal(
    archive,
    join(root, "dist", `pargoo-strapi-editor-${manifest.version}.zip`),
  );
});

test("rebuilds use current skill content and ignore source file timestamps", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const skill = join(root, "skills", "strapi-editor", "SKILL.md");
  const original = await readFile(skill, "utf8");
  const first = await readFile(await buildPackage(root));
  const changed = `${original}\nAn additional editorial instruction.\n`;
  await writeFile(skill, changed);
  const archive = await buildPackage(root);
  assert.equal(
    unzip(["-p", archive, "skills/strapi-editor/SKILL.md"]).toString(),
    changed,
  );
  const second = await readFile(archive);
  assert.notDeepEqual(second, first);
  await utimes(skill, new Date("2024-01-01"), new Date("2025-01-01"));
  assert.deepEqual(await readFile(await buildPackage(root)), second);
});

test("support files are included while local files and dependencies stay out", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const skill = join(root, "skills", "strapi-editor");

  for (const name of [
    "references/format.md",
    "assets/example.txt",
    "scripts/helper.txt",
    "agents/openai.yaml",
    "references/.env",
    "scripts/node_modules/private.txt",
    "assets/dist/private.txt",
    ".env",
    "unrelated.txt",
  ]) {
    await mkdir(dirname(join(skill, name)), { recursive: true });
    await writeFile(join(skill, name), name);
  }

  const archive = await buildPackage(root);
  const files = unzip(["-Z1", archive]).toString().trim().split("\n");
  assert.deepEqual(files, [
    "README.md",
    "plugin.json",
    "skills/strapi-editor/SKILL.md",
    "skills/strapi-editor/agents/openai.yaml",
    "skills/strapi-editor/assets/example.txt",
    "skills/strapi-editor/references/format.md",
    "skills/strapi-editor/scripts/helper.txt",
  ]);
  assert.equal(
    unzip([
      "-p",
      archive,
      "skills/strapi-editor/references/format.md",
    ]).toString(),
    "references/format.md",
  );
});

test("symlinked supporting files cannot pull data into a customer package", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const references = join(root, "skills", "strapi-editor", "references");
  await mkdir(references);
  await writeFile(join(root, "private.txt"), "not for distribution");
  await symlink(join(root, "private.txt"), join(references, "leak.txt"));
  await assert.rejects(buildPackage(root), /Symlinks are not allowed/);
  await assert.rejects(readdir(join(root, "dist")), { code: "ENOENT" });
});

test("a symlinked skill directory cannot redirect the package source", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const skill = join(root, "skills", "strapi-editor");
  const redirected = join(root, "redirected-skill");
  await rename(skill, redirected);
  await symlink(redirected, skill);
  await assert.rejects(buildPackage(root), /real directory, not a symlink/);
});

test("invalid metadata and missing skills leave the previous archive intact", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = await buildPackage(root);
  const original = await readFile(archive);
  const manifestPath = join(root, "scripts", "strapi-editor.plugin.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  for (const invalid of [
    { ...manifest, version: "../../escape" },
    { ...manifest, version: "01.0.0" },
    { ...manifest, apps: "./.app.json" },
    { ...manifest, extensions: { "com.openai": { apps: "./.app.json" } } },
  ]) {
    await writeFile(manifestPath, JSON.stringify(invalid));
    await assert.rejects(buildPackage(root));
    assert.deepEqual(await readFile(archive), original);
  }

  await writeFile(manifestPath, JSON.stringify(manifest));
  await rm(join(root, "skills", "strapi-editor", "SKILL.md"));
  await assert.rejects(buildPackage(root), { code: "ENOENT" });
  assert.deepEqual(await readFile(archive), original);
});
