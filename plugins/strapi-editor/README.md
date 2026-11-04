# pargoo Strapi (Apple Silicon)

A Codex plugin for editing Strapi content and uploading original images. Its panel manages projects, environments and Production publication approvals. Requires macOS 13+ on Apple Silicon and a compatible Strapi MCP endpoint.

## Install and update

The published package includes Node.js and the compiled macOS helper. Editors do not install Node.js, npm, Swift or Xcode.

Ask your agent to install pargoo Strapi from this repository. The agent uses the application's bundled Codex CLI, or an existing `codex` executable:

```sh
PARGOO_CODEX_BIN="${CODEX_APP_RUNTIME_CLI_PATH:-codex}"
"$PARGOO_CODEX_BIN" plugin marketplace add https://github.com/pargoo-GmbH/agent-lab.git --ref main --sparse .agents/plugins --sparse plugins/pargoo-devflow --json
"$PARGOO_CODEX_BIN" plugin add strapi-editor@pargoo-agent-lab --json
```

These commands require the package to have been published first. The shared `pargoo-agent-lab` catalogue is on `main`; the ready package is under `packages/strapi-editor` on `stable`. Open a new chat after installation.

For updates, ask **Update pargoo**. The installed skill runs Codex's marketplace upgrade and checks the new MCP. Open a new chat to load the updated tools and panel. Connections and Keychain entries stay on the Mac; keep only one active installation of `strapi-editor`.

## How it works

Codex starts the bundled Node runtime and connects to our local MCP over stdin/stdout. The local MCP connects to the selected Strapi MCP over HTTPS. Image uploads go to Strapi Admin `/upload` using the confirmed connection.

The panel is a React application embedded in a single HTML file. Codex reads it from the MCP resource `ui://strapi-editor/editor.html` and displays it in an iframe. It needs no domain or web server. Panel actions go through the MCP Apps bridge; the panel makes no direct Strapi requests.

Create a project, add an environment, enter its Strapi base URL and Admin token in the panel, then select **Use**. Each chat has its own confirmed environment. Tokens belong in the panel, never in chat. Only publishing and unpublishing in Production require extra panel confirmation. If a write result is uncertain, inspect Strapi before retrying it.

Settings live in `~/Library/Application Support/Strapi Editor`; tokens live in macOS Keychain under `com.pargoo.strapi-editor`. Package updates preserve both. The agent workflows are documented in `skills/`.

## Source layout

```text
assets/              Plugin icon
src/
  client/            React panel
  server/            Local MCP, Strapi client and storage
    native/          Swift helper for Keychain and image selection
    runtime/         Prepared Node binary and its license
  shared/            Shared types and version
skills/              Setup, content editing, images and updates
scripts/
  build.ts           Build the self-contained package
  check.ts           Validate the package or check the desktop loader
  dev.ts             Run the browser preview with synthetic Strapi projects
  dev/               Preview HTML/host and desktop diagnostic
  release.ts         Set a version and publish a package to stable
  updater.ts         Installed update workflow; bundled into the package
```

TypeScript/TSX is used for application code and scripts. Tests live next to the code they check as `*.test.ts`; development and test files are excluded from the installable bundle. `dist/` and `node_modules/` are ignored by Git. Build workspaces are temporary and removed when the build finishes; no project `.cache` is needed.

## Development

Use macOS on Apple Silicon, Node.js **22.21.1** from `.nvmrc`, npm and Xcode Command Line Tools.

Run npm commands in `plugins/strapi-editor`. From the repository root:

```sh
cd plugins/strapi-editor
npm ci
npm run format
npm run verify
```

`format` applies ESLint fixes and Prettier. ESLint requires braces and blank lines before and after conditionals/loops and before `return`. `verify` runs TypeScript, ESLint, formatting checks, the build and all tests. `npm run dev` starts the browser preview with temporary settings and synthetic credentials. `npm run check:desktop` checks the real Codex loader and removes its diagnostic installation afterwards.

Settings writes use a macOS kernel lock on the persistent `settings.lock` file. When replacing a development installation that used PID-file locks, restart Codex before using this build so older MCP processes cannot write the same settings concurrently.

The build bundles server/UI/updater code, compiles and signs the Swift helper, and copies Node and its license from `src/server/runtime`. That directory contains the prepared, stripped and ad-hoc signed **darwin-arm64 Node 22.21.1**, committed with the source. The build verifies its signature, version and architecture; it never copies Node or its license from the developer's installation. Replace the prepared runtime and license together when changing the pinned Node version.

The Swift helper source is in `src/server/native`; preview HTML/host and the Codex desktop diagnostic live in `scripts/dev`. The ready `dist/` includes only manifests, assets, skills, runtime code, native binaries and license notices. Source, tests, preview tools and development dependencies stay out of the package.

## Release

Run these commands in `plugins/strapi-editor`. `version:set` updates all version fields and formats the JSON automatically:

```sh
npm run version:set -- <x.y.z>
npm run release -- --dry-run
```

From the repository root, the same dry run is `npm --prefix plugins/strapi-editor run release -- --dry-run`.

Review, commit and publish the source separately. Once local `main` is clean and matches `origin/main`, run the authorized publication command:

```sh
npm run release
```

It verifies and builds, replaces only `packages/strapi-editor` in a temporary Git checkout and pushes `stable`. It creates the branch on the first release, preserves other packages and refuses repeated or older versions. It never commits source, switches your branch or pushes `main`. There is no CI release job. `--dry-run` makes no commit or push.

Builds use ad-hoc signatures by default. `PARGOO_SIGNING_IDENTITY` selects a Developer ID Application identity; certificates stay outside Git. Notarization is not automated. Before customer delivery, verify installation, Keychain, image selection and updates on another Mac. Preserve the plugin ID, data directory and Keychain service across releases.
