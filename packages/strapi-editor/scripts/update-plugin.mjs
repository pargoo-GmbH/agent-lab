// scripts/updater.ts
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
var marketplaceName = "pargoo-agent-lab";
var pluginId = "strapi-editor@pargoo-agent-lab";
var repository = "pargoo-gmbh/agent-lab";
var normaliseRepository = (value) => String(value).replace(/^https:\/\/github\.com\//i, "").replace(/^git@github\.com:/i, "").replace(/\.git\/?$/, "").replace(/\/$/, "").toLowerCase();
var versionParts = (value) => {
  assert.match(value, /^\d+\.\d+\.\d+$/, "Expected a stable x.y.z plugin version.");
  return value.split(".").map(Number);
};
var compareVersions = (a, b) => {
  const first = versionParts(a), second = versionParts(b);
  for (let index = 0; index < 3; index++) {
    if (first[index] !== second[index]) {
      return Math.sign(first[index] - second[index]);
    }
  }
  return 0;
};
async function checkInstalled(installedPath, version) {
  const root = resolve(installedPath);
  const manifest = JSON.parse(await readFile(join(root, "plugin.json"), "utf8"));
  assert.equal(manifest.name, "strapi-editor");
  assert.equal(manifest.version, version);
  const registration = JSON.parse(await readFile(join(root, "mcp.json"), "utf8")).mcpServers["strapi-editor"];
  assert.equal(registration.type, "stdio");
  assert.equal(registration.command, "./runtime/node");
  assert.deepEqual(registration.args, ["${PLUGIN_ROOT}/server/index.mjs"]);
  assert.equal(registration.cwd, "${PLUGIN_ROOT}");
  const directory = await mkdtemp(join(tmpdir(), "pargoo-update-check-"));
  const child = spawn(join(root, "runtime/node"), [join(root, "server/index.mjs")], {
    cwd: root,
    env: { ...process.env, PATH: "/usr/bin:/bin", STRAPI_EDITOR_DATA_DIR: directory },
    stdio: ["pipe", "pipe", "pipe"]
  });
  const lines = createInterface({ input: child.stdout });
  const pending = /* @__PURE__ */ new Map();
  let serial = 0;
  const fail = (error) => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    pending.clear();
  };
  child.on("error", fail);
  child.on(
    "exit",
    () => fail(new Error("The updated MCP process stopped before completing its startup check."))
  );
  child.stdin.on("error", fail);
  child.stderr.resume();
  lines.on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    const entry = pending.get(message.id);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timer);
    pending.delete(message.id);
    if (message.error) {
      entry.reject(new Error("The updated MCP rejected a startup check."));
    } else {
      entry.resolve(message.result);
    }
  });
  const request = (method, params) => new Promise((resolveRequest, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`MCP startup check timed out: ${method}`));
    }, 1e4);
    pending.set(id, { resolve: (value) => resolveRequest(value), reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
  try {
    const host = await request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "pargoo-update-check", version: "1.0.0" }
    });
    assert.equal(host.serverInfo.version, version);
    child.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n"
    );
    const catalogue = await request("tools/list", {});
    assert(catalogue.tools.some((tool) => tool.name === "strapi_editor_open"));
    assert(catalogue.tools.some((tool) => tool.name === "strapi_call"));
    const resource = await request("resources/read", {
      uri: "ui://strapi-editor/editor.html"
    });
    assert(
      resource.contents.some(
        (item) => item.text?.includes("pargoo Strapi (Apple Silicon)") && !item.text.includes("/* APP_SCRIPT */")
      )
    );
    return { toolCount: catalogue.tools.length };
  } finally {
    lines.close();
    child.kill();
    fail(new Error("Startup check closed."));
    await rm(directory, { recursive: true, force: true });
  }
}
async function updatePlugin({
  binary = process.env.STRAPI_EDITOR_CODEX_BIN ?? process.env.CODEX_APP_RUNTIME_CLI_PATH ?? "codex",
  run = execFileSync,
  check = checkInstalled,
  read = readFile,
  installationRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
} = {}) {
  const cli = (args) => JSON.parse(
    run(binary, ["plugin", ...args, "--json"], {
      encoding: "utf8",
      timeout: 12e4,
      maxBuffer: 4 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"]
    })
  );
  const marketplaces = cli(["marketplace", "list"]);
  const marketplace = marketplaces.marketplaces.find((item) => item.name === marketplaceName);
  assert(
    marketplace,
    "The pargoo-agent-lab marketplace is not connected. Follow the installation instructions in the repository README."
  );
  assert.equal(
    marketplace.marketplaceSource?.sourceType,
    "git",
    "Update requires the Git-backed pargoo-agent-lab marketplace. Local development catalogues are not updated from GitHub."
  );
  assert.equal(
    normaliseRepository(marketplace.marketplaceSource.source),
    repository,
    "The pargoo-agent-lab marketplace points to a different repository. Existing settings were preserved."
  );
  const before = cli(["list", "--marketplace", marketplaceName]).installed.find(
    (item) => item.pluginId === pluginId
  );
  assert(
    before,
    "The marketplace plugin is not installed. Follow the initial installation instructions."
  );
  assert(
    before.enabled !== false,
    "The plugin is disabled. Enable it in Plugins before applying an update."
  );
  versionParts(before.version);
  assert.equal(
    basename(installationRoot),
    before.version,
    "Run the updater from the current installed plugin, not a source checkout or an older chat. Open a new chat and retry."
  );
  const validateCatalogue = async (marketplace2) => {
    const catalogue = JSON.parse(
      await read(join(marketplace2.root, ".agents/plugins/marketplace.json"), "utf8")
    );
    const entry = catalogue.plugins.find((item) => item.name === "strapi-editor");
    assert(entry, "The marketplace no longer lists strapi-editor.");
    assert.equal(
      entry?.source?.source,
      "git-subdir",
      "Unexpected plugin source in the marketplace."
    );
    assert.equal(
      normaliseRepository(entry.source.url),
      repository,
      "The plugin source points to a different repository."
    );
    assert.equal(entry.source.ref, "stable", "Unexpected plugin release branch.");
    assert.equal(
      entry.source.sha,
      void 0,
      "The plugin source is pinned to a commit instead of the stable release branch."
    );
    assert.equal(
      entry.source.path,
      "./packages/strapi-editor",
      "Unexpected plugin path in the marketplace."
    );
  };
  await validateCatalogue(marketplace);
  const upgrade = cli(["marketplace", "upgrade", marketplaceName]);
  assert(
    !upgrade.errors?.length,
    "Marketplace refresh reported an error. Some updates may already have been applied; inspect the installed version before retrying."
  );
  const refreshed = cli(["marketplace", "list"]).marketplaces.find(
    (item) => item.name === marketplaceName
  );
  assert(refreshed, "The pargoo-agent-lab marketplace disappeared after refresh.");
  await validateCatalogue(refreshed);
  const after = cli(["list", "--marketplace", marketplaceName]).installed.find(
    (item) => item.pluginId === pluginId
  );
  assert(after, "Codex did not report an installed plugin after refresh.");
  const comparison = compareVersions(after.version, before.version);
  assert(
    comparison >= 0,
    "Codex installed an older release. Inspect the installed version and the stable branch before proceeding."
  );
  if (comparison === 0) {
    return { status: "up_to_date", pluginId, version: after.version, restartRequired: false };
  }
  const verified = await check(join(dirname(installationRoot), after.version), after.version);
  return {
    status: "updated",
    pluginId,
    previousVersion: before.version,
    version: after.version,
    ...verified,
    restartRequired: true,
    message: "Open a new chat to load the updated plugin. Existing profiles and credentials were preserved."
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    assert(
      process.platform === "darwin" && process.arch === "arm64",
      "This release supports macOS on Apple Silicon."
    );
    console.log(JSON.stringify(await updatePlugin(), null, 2));
  } catch (error) {
    console.error(
      `pargoo update failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  }
}
export {
  checkInstalled,
  updatePlugin
};
