---
name: setup
description: Open the pargoo Strapi panel, manage projects and environment connections, or check MCP access on macOS.
---

Call `strapi_editor_open` to open connections and settings. Reuse this chat's contextId when reopening; create a context only if this chat has none. Never reuse another chat's context. The compact **Open pargoo** button expands the panel into preview.

Reuse an already confirmed environment. Ask the user to select one only when no target is confirmed or the requested target differs. The panel owns settings and connection status; do not reproduce its forms or routine status cards in chat. Selection updates agent context silently and needs no automatic follow-up message.

Guide setup through the panel:

- **New project** creates a project with its name only.
- **Add environment** saves a unique name, Development or Production type, Strapi base URL and Admin token. Several environments may share a type. One token can serve MCP and uploads; a separate upload token is available under Advanced settings.
- **Settings → Check connection** checks the saved environment. **Use** confirms its displayed name, type and URL for this chat; **In this chat** marks the selection. Browsing settings or another project does not switch environments. After saving edits, confirm that environment again.

For a requested access check of the confirmed target, read `strapi_editor_context` and call `strapi_discover`. Report its actual result; it does not update the panel's saved check badge. Remove an environment through its Settings; a project must be empty before it can be removed. Removing connections does not delete Strapi content.

The user enters tokens only in the panel, which saves them to Keychain. Do not request tokens in chat, read another connection's credentials, print private configuration or pass credentials to shell commands.

A successful connection check proves MCP access, not upload Create permission. Run a test upload only when requested. If the panel or bundled runtime cannot start, report the actual error and supported package; do not ask the editor to install Node.js, use a terminal or weaken permissions.
