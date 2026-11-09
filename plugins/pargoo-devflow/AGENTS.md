# pargoo DevFlow

## Versioning

Follow [Semantic Versioning](https://semver.org/) for `plugin.json`.

When preparing changes to this plugin for release, increment its version:

- **PATCH** — bug fixes, branding, metadata, and other backward-compatible refinements.
- **MINOR** — new skills or backward-compatible capabilities.
- **MAJOR** — breaking changes to existing workflows or interfaces.

Bump the version once per release, based on the latest version in `main`. Do not change versions of other plugins.

## Skill Development Guidelines

Apply these rules when creating or modifying skills in `plugins/pargoo-devflow`.

1. **Conciseness.** Include only necessary instructions. Avoid filler, obvious explanations, redundant rules, and excessive examples.
2. **Clear responsibility.** Each skill must have a well-defined purpose. Do not duplicate behavior across skills.
3. **Independence.** Skills must remain independently usable. Introduce cross-skill dependencies only when justified by the delegated operation.
4. **Minimal changes.** Modify only what is required. Preserve unrelated functionality and behavior.
5. **No historical context.** Do not add deprecation notices, descriptions of previous behavior, or migration explanations.
6. **Simple architecture.** Avoid additional skills, files, abstractions, or workflow phases unless genuinely necessary.
7. **Agent autonomy.** Define behavioral principles and important constraints rather than enumerating every possible scenario. Allow agents to make reasonable, evidence-based decisions.
8. **Metadata consistency.** Follow existing `SKILL.md` and `agents/openai.yaml` conventions, including `name`, `description`, `display_name`, `short_description`, and `default_prompt`.
9. **Branding consistency.** Preserve pargoo DevFlow branding, including `author: "pargoo GmbH"`, `website: "https://www.pargoo.com/"`, and the existing attribution in `SKILL.md`.
10. **Preserve contracts.** Do not weaken existing approval gates, permissions, delegation rules, or workflow sequencing.
11. **Verification.** Run applicable skill validation, review the complete diff, and test affected scenarios. Clearly distinguish executed tests from unverified assumptions.

**Orchestrator-specific rule:** `develop` coordinates skills and manages workflow state. Keep specialized behavior in the responsible skills; do not duplicate their internal logic in the orchestrator.
