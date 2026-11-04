---
name: update
description: Update the installed pargoo Strapi plugin when explicitly requested; excludes content edits and Strapi server upgrades.
---

Use this workflow for an explicit request such as **Update pargoo**. A version-only question does not authorise an update.

1. Resolve the installed plugin root by going up two directories from this skill's directory. Verify `plugin.json`, `runtime/node` and `scripts/update-plugin.mjs` exist there. A source checkout without these files is not an installed package; do not build or publish it as part of an editor's update.
2. Run the bundled runtime with the updater, substituting the verified absolute root:

   ```sh
   "<plugin-root>/runtime/node" "<plugin-root>/scripts/update-plugin.mjs"
   ```

   The script uses the application's bundled CLI through `CODEX_APP_RUNTIME_CLI_PATH`, or an available `codex` executable. If neither exists, report the limitation; do not install Node.js, npm or developer tools.

3. Read the JSON result. Codex refreshes the shared `pargoo-agent-lab` marketplace and installs the package referenced on `stable`; the updater verifies the installed version and, after an update, MCP startup. It does not read saved credentials or call a CMS. Report the previous and new versions, or that the version is unchanged.
4. After an update, ask the user to open a new chat to load the new tools and panel. If the updater says this chat uses an older package, open a new chat before retrying.

On failure, stop and report the actual error. The installation may already have changed before a later check failed; inspect Codex's installed plugin list before retrying. Do not report success without the updater's verification, uninstall another plugin, delete caches/settings, change marketplace sources or modify saved profiles and Keychain entries.
