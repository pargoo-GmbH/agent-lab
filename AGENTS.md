# agent-lab

## Task Tracking

We use GitHub Projects to manage and track work for this repository.

**GitHub Project:** https://github.com/orgs/pargoo-GmbH/projects/5

## Working conventions

Each directory under `plugins/` is an independent project. Keep application code under `src/`, server-native helpers under `src/server/native/`, agent workflows under `skills/`, and build, development, release and installed-update scripts under `scripts/`. Keep `*.test.ts` tests next to the code they check, preview and desktop diagnostic helpers under `scripts/dev/`, and project documentation in the plugin README.

For Strapi Editor, run `npm ci`, `npm run format` and `npm run verify` from `plugins/strapi-editor`. Use TypeScript/TSX and the project's ESLint/Prettier rules, including blank lines around conditionals/loops and before returns. Edit source; regenerate the ignored `dist/` with its build script.

Strapi Editor source lives on `main`; its ready package lives under `packages/strapi-editor` on `stable`. Use its own release script; there is no CI publication workflow or shared builder. `npm run release -- --dry-run` builds and previews without a commit or push. `npm run release` publishes and requires explicit authorization.

Keep repository documentation and interface copy in English. Respond in the user's language. Do not commit, push or publish unless explicitly requested.
