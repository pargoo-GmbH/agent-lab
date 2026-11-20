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

## Behavioral Change Review

**Baseline.** Before editing DevFlow skills, inspect the working tree for pre-existing changes, record the current Git commit SHA, and identify the skills relevant to the requested change. Distinguish pre-existing changes from changes made for the current task. If they cannot be reliably separated, disclose the limitation in the final report. Use that original SHA throughout the task, including after corrections, commits, and resumes. If the original SHA cannot be recovered, report the comparison gap.

**Implementation.** Continue normal editing, corrections, and targeted verification as needed. After meaningful workflow changes, consider effects on related skills and existing guarantees. Investigate unintended or out-of-scope behavior changes and get user direction before adopting them.

**Final review.** Automatically perform one consolidated review when implementation is ready for user review, before presenting it as ready for approval or PR publication. Run or refresh it whenever the user explicitly requests it. Compare the original revision with the final working tree, accounting for all relevant committed, staged, and unstaged changes and relevant new files. Analyze behavior across affected skills, including related skills whose files were untouched. Where relevant, cover workflow sequencing, transitions and recovery, skill responsibilities and delegation, authorization and safety, issue, branch and PR lifecycle, verification, independent review and reporting, and completion conditions and state preservation.

Present a concise report with five sections, scaled to the size of the change.

1. **Summary.** State what was implemented and which skills were affected.
2. **Behavioral Changes.** For each material behavior, show **Before**, **After**, **Classification**, and **Evidence**. Prefer a compact table when multiple behaviors are involved. Classify findings as intended change, unintended change, preserved guarantee, or unverified behavior. Cite source locations for material conclusions. Support preserved guarantees with evidence that the behavior still holds in context, even when the relevant files are unchanged.
3. **Potential Regressions.** Note unexpected changes, contradictions between skills, and risks needing correction or a user decision. If none were identified, say so without claiming exhaustive coverage.
4. **Verification.** List checks and results, checks blocked or skipped, and evidence limits. Distinguish instruction-level consistency checks from actual runtime tests.
5. **Final Assessment.** State whether the result matches the request, which behavior changes require explicit user approval, and what remains unresolved before acceptance. Clearly disclose behavior changes outside the explicit request.

Present the final report before requesting publication approval. Keep existing verification, independent review, reporting, safety, and authorization requirements in force.
