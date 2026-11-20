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

**Baseline.** Before editing DevFlow skills, inspect the working tree, record the starting Git commit SHA and relevant skills, and identify pre-existing changes. Keep that SHA as the baseline through corrections, commits, and resumes. If pre-existing changes cannot be separated from this task, or the baseline cannot be recovered, disclose the limitation.

**Implementation.** Iterate, correct, and run targeted verification as needed. After meaningful workflow changes, assess effects on related skills and existing guarantees. Investigate unintended or out-of-scope changes and seek user direction before adopting them. Do not produce a full review after each edit.

**Final review.** Automatically produce one consolidated review when implementation is ready for user review, before presenting it as ready for approval or PR publication; run or refresh it on explicit user request. Compare the original baseline with the final working tree, including relevant committed, staged, unstaged, and new files. Analyze behavior across affected and related skills, including unchanged files. Where relevant, examine workflow sequencing, transitions, and recovery; skill ownership and delegation; authorization and safety; Issue, branch, and PR lifecycle; verification, independent review, and reporting; and completion conditions and state preservation.

Use the five numbered headings below in order as Markdown `##` headings, with the numbers and titles shown. Keep the report concise and in plain language.

1. **Summary**. Briefly state the request, outcome, and affected skills. Use `Requested: N · Additional: N · Preserved: N · Potential regressions: N` as the count line.
2. **Behavioral Changes**. Show these groups in order and group changes by the scope of the user's request.
   - **Requested changes (N)**. Show requested additions, modifications, and removals in the table format below.
   - **Additional changes — not requested (N)**. Use the same table for changes outside the explicit request. Flag every such addition, modification, or removal for explicit user review, including deliberate agent-initiated changes. If none were identified, show only `Additional changes: 0 found` for this group.
   - **Preserved guarantees (N)**. Briefly state which important related guarantees hold in both revisions. Support them with contextual evidence, even when the relevant files are unchanged.

   Use exactly three columns for requested and additional changes. Keep cells short. Show baseline behavior in **Before**, using `Not present` for entirely new behavior, and final behavior in **After**.

   | Behavior | Before | After |
   | --- | --- | --- |

   For each material finding, give **Classification** and **Evidence** on short lines tied to that finding, below its table where applicable. Classify findings as intended change, unintended change, preserved guarantee, or unverified behavior. Keep unverified behavior distinct from preserved guarantees. Cite precise source locations for both baseline and final behavior where relevant.

3. **Potential Regressions**. If no material regressions or risks were identified, write `Potential regressions: 0 found`. Otherwise give each material finding's impact and evidence, including unexpected effects, cross-skill contradictions, and decisions needed. Distinguish confirmed problems, suspected risks, and untested scenarios. Keep conclusions within the reviewed scope.
4. **Verification**. Start with the first applicable status in this order. Use `Failed` if any applicable check failed, `Partial` if any relevant check was blocked, skipped, or remains unverified, and `Passed` only when all applicable required checks passed and no relevant verification gaps remain. Briefly list passed checks, reasons for failed or blocked checks, significant unperformed checks, and evidence limits. Identify narrower substitutes as such and distinguish instruction-level checks from runtime tests.
5. **Decision**. End with one of `Ready for review`, `Approval needed`, `Changes needed`, or `Verification needed`. Give a short reason or the exact action or user decision needed before acceptance or publication. Base the status on whether the requested behavior appears implemented, remaining risks and verification gaps, and any explicit approvals still required. Unrequested changes require explicit user approval. Refer to the findings above for details.

Keep existing verification, independent review, reporting, safety, and authorization requirements in force.
