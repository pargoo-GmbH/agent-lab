# Strapi editor skill

A shared editorial workflow for ChatGPT web and Codex, used with a separately
connected Strapi gateway. `SKILL.md` is the only source of workflow instructions.
This skill is independent of the macOS application in `plugins/strapi-editor`.

## Requirements

The chosen gateway must expose `get_project_context` and `get_content_guide`
with `contractVersion: 1`, consistent `projectId` and `environment` values, and
the actual content tools and schemas described by its guide. Image uploads also
require `upload_chat_image` and the host's original-attachment transfer support.
A version number alone does not establish compatibility with these behaviors.

The user connects and authorizes each project gateway separately. This package
contains no MCP server, credentials, endpoint or customer-specific App binding.
Use only gateways supplied or approved by the customer's administrator.

## Customer setup

For ChatGPT web, attach the provided ZIP in a chat with Plugin Creator available
and use this prompt:

> Create a private plugin from the attached ZIP, preserving its manifest and
> bundled skills. This is a skills-only plugin; I will connect the project's
> Strapi gateway separately. Give me the resulting plugin link and installation
> steps.

After installing the plugin, connect the intended gateway through the host's
connection flow, then start a new chat with both available. Specify the project
and environment in the first content request. If Plugin Creator or the required
connection is unavailable, ask the workspace administrator to enable the supported
installation path. Attaching a ZIP alone does not install a plugin.

For agents supporting standalone skills, install this directory as
`strapi-editor`, including any supporting files. The same gateway requirements
apply. Installation does not grant access to a CMS or approve content changes.

## Build the customer ZIP

Maintainers need Node.js 22.23.5 or a later supported release, plus `zip` and
`unzip` on `PATH`. Customers do not need these tools. From the repository root:

```sh
node --experimental-strip-types scripts/package-strapi-editor.ts
node --experimental-strip-types --test scripts/package-strapi-editor.test.ts
```

The builder reads the version and plugin metadata from
`scripts/strapi-editor.plugin.json`. Bump its version before distributing a changed
package. It copies this README and the current skill files into a complete,
reproducible archive under `dist/`:

```text
pargoo-strapi-editor-<version>.zip
├── plugin.json
├── README.md
└── skills/
    └── strapi-editor/
        └── SKILL.md
```

Optional `agents/`, `references/`, `scripts/` and `assets/` within the skill are
included when present. Hidden files, dependency/build directories and symlinks
are not packaged. Generated archives stay out of Git. The builder never embeds
or generates editorial instructions and never publishes or changes a marketplace.

The archive is for private customer setup. It has not been installed or tested
against a live customer gateway by the packaging checks. Public directory
submission requires separate listing materials, publisher verification and
review. The GitHub marketplace and the existing desktop plugin remain separate.
