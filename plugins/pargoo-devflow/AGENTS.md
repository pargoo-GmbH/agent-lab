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

Present a concise, plain-language report with five sections, scaled to the change:

1. **Summary.** State the request, outcome, affected skills, changes outside the request, and pending decisions. If none were identified, write “No additional behavior changes identified”.
2. **Behavioral Changes.** Group findings by the user's request, not the implementer's intent:
   - **Requested changes:** Behavior added, modified, or removed to fulfill the request.
   - **Additional changes — not requested:** Behavior added, modified, or removed outside the explicit request, including agent-initiated changes. Flag these for explicit user review.
   - **Preserved guarantees:** Important related behavior still supported by contextual evidence, even in unchanged files.

   For each material finding, show **Before → After**, **Classification**, and **Evidence** separately. Use “Not present” for entirely new behavior. Classify findings as intended change, unintended change, preserved guarantee, or unverified behavior; keep uncertainties separate from preserved guarantees. Cite precise original and final source locations where relevant. Prefer compact comparisons with classification and evidence below, not wide tables.

3. **Potential Regressions.** Report material risks, unexpected effects, cross-skill contradictions, and decisions needed. Distinguish confirmed findings from suspected or untested risks. If none were identified, say so without claiming exhaustive coverage.
4. **Verification.** Report passed, failed, blocked, and unperformed checks and evidence limits. Distinguish instruction-level checks from runtime tests.
5. **Final Assessment.** State whether the requested behavior appears implemented, what additional or other behavior changes need approval, remaining risks and verification gaps, and decisions needed before acceptance or publication.

Keep existing verification, independent review, reporting, safety, and authorization requirements in force.
