---
name: review-implementation
description: Discover and run a project's verification checks, then review the complete implementation branch against its intended base, including committed and local changes. Use when Codex needs to verify an implementation before a GitHub issue update, PR, commit, handoff, or release note; when the user asks to review code; or when the user asks to run lint, typecheck, tests, build checks, or all project checks.
metadata:
  author: "pargoo GmbH"
  website: "https://www.pargoo.com/"
---

# Review Implementation

*Built by the team at [pargoo](https://www.pargoo.com/).*

Use this skill to verify and review repository changes before they are described as complete. Discover the project's own checks from its manifests, scripts, docs, CI config, and conversation context instead of assuming a specific package manager, framework, or command shape.

## Workflow

1. **Build context**
   - Reuse the caller's active Issue and agreed scope; read its current requirements/acceptance criteria, relevant comments and parent Issue context. Never select the latest open Issue or ask for a known URL again. For standalone work without an Issue use explicit task requirements and disclose the absence; inaccessible required Issue information is BLOCKED.
   - Read repository instructions such as `AGENTS.md`, `README`, docs linked from those files, and relevant area-specific guidance.
   - Resolve the intended base from explicit user or downstream-workflow context, an existing PR base, an explicitly established parent integration branch, or the repository's discovered default branch for ordinary work. Do not hardcode a base branch or guess when these signals conflict.
   - Ensure the base ref is available and sufficiently current to support the review. If the intended base cannot be resolved or inspected, mark the review blocked.
   - Inspect the complete committed branch diff against the intended base using merge-base semantics, such as `<base>...HEAD`.
   - Inspect local changes in addition to the committed branch diff: staged, unstaged, and untracked files. Do not rely on a working-tree-only diff because it omits committed implementation work.
   - Inspect the commit list and diff statistics for the same range to detect unexpected scope or missing changes.
   - Inspect changed files directly when the diff alone is not enough to understand behavior.
   - Review code that handles sensitive information without unnecessarily reading or exposing actual credentials, private key material, secret-bearing environment/configuration values, or other confidential values. Prefer references, configuration structure, and relevant behavior when actual values are not needed.
   - If the touched area has a matching local skill or project rule, use it before judging that area.

2. **Discover verification commands**
   - Look for available commands in project manifests and task files such as `package.json`, lockfiles, workspace files, Makefiles, task runners, language-specific config, CI workflows, and repository docs.
   - Prefer commands that the repository already defines for linting, typechecking, tests, builds, formatting checks, generated-code checks, migrations, or framework validation.
   - For JavaScript and TypeScript projects, infer the package manager from lockfiles and scripts before choosing how to run a script.
   - Use explicit user instructions when they narrow the verification scope or name the expected checks.
   - If several reasonable commands exist, prefer the smallest set that covers lint/static analysis, type or compile checks, and tests for the changed behavior.
   - Do not invent commands. If a category has no discoverable command, report it as unavailable or not run with the evidence used to decide.

3. **Run required verification**
   - Before executing a discovered command, make a lightweight, risk-based check of it and relevant underlying scripts for sensitive output, such as environment/configuration dumps, credential or authentication-header logging, and shell tracing. Where practical, use safe synthetic values or capture and sanitize output before it reaches the tool transcript, retaining useful failure diagnostics and the actual exit status. Do not discard all output if that loses meaningful evidence. If safe execution is not possible, report a verification gap instead of a pass.
   - Run full-project checks by default when they are discoverable and practical.
   - Use scoped checks when the user requests scoped verification, the change is narrow and the repository supports scoped checks, or a full check is clearly impractical in the current environment. State the scope plainly.
   - Reuse available check evidence only when its revision, local-change coverage, and scope still apply; run affected checks after corrections rather than duplicating unchanged verification.
   - Treat failing lint/static analysis, type/compile, test, or required build commands as blocking for workflows that need a completion signal.
   - If a command is unavailable, blocked by the environment, or requires approval that is not granted, report it as a verification gap instead of marking it passed.
   - If a command fails, capture the command, summarize the relevant failure output, infer the likely root cause, and suggest the shortest fix path.

4. **Review the implementation independently**
   - After required checks pass, read the complete `references/reviewer-prompt.md` relative to this skill's installed directory. Include its actual contents and the review assignment in the child task, not merely a relative path. Spawn exactly ONE fresh built-in general-purpose subagent per independent review attempt; never review in the orchestrator's own context.
   - On Codex, use the available native `spawn_agent` interface with its built-in `default` role where a role selector exists; otherwise use the general-purpose default. Select fresh context with `fork_turns: "none"` or the interface's equivalent (such as `fork_context: false`). Adapt argument names to the actual exposed tool schema; do not assume a custom agent or override model or reasoning effort.
   - On Claude Code, use the native `Agent` tool with `subagent_type: "general-purpose"`, supplying the same complete reviewer instructions and assignment in its prompt. An ordinary, non-fork subagent starts with fresh context by default; a separate fresh-context parameter is not required. Create a new subagent rather than resuming an existing one or forking the conversation, and do not pass the implementer's conversation history.
   - If the prompt or independent subagent tool is unavailable, launch fails, or a fresh, independent subagent cannot be guaranteed, return `Independent review: BLOCKED`; do not simulate PASS, substitute self-review, or repeatedly launch. The absence of a dedicated fresh-context parameter alone is not a blocker when the tool guarantees fresh context by default.
   - Hand off only the repository/Issue source references, authoritative scope and criteria, relevant comments/parent context, applicable instructions/docs, intended base ref and resolved commit/merge-base, HEAD revision and local-change coverage, available check commands/results and revision, and concise previous blocking findings for re-review. Do not copy the entire implementation conversation. Have the reviewer independently inspect original sources, the complete current diff, and surrounding code; summaries are leads, not proof. Re-review covers previous findings AND the complete current implementation.
   - Require read-only behavior: no file changes, fixes, commits, push, PR/Issue writes, workflow delegation, or nested agents. Subagents inherit session sandbox/permissions; instructions alone do not enforce read-only access. Use an actual read-only environment when available and appropriate, preserve existing permission controls, and never weaken the main workflow sandbox for review.
   - Wait for the one reviewer to finish and return the consolidated result to the actual caller: the user when invoked directly, or the calling skill otherwise. Check scope/base/revision/local coverage match the assignment and the result is complete; missing essential evidence or a malformed/incomplete report is BLOCKED. If the implementation or requirements changed during review, do not certify the newer work with a stale result; return BLOCKED for reassessment by the caller. Do not implement corrections, recursively invoke an orchestrator, or manage retry counts; automatic Review Cycles apply only when managed by `develop`.
   - For an explicitly verification-only request, run the requested checks without spawning a reviewer and mark independent review not performed; this narrower output cannot satisfy the Develop independent-review gate.
   - The independent review should examine behavioral bugs, regressions, accessibility issues, data-shape mismatches, routing or integration mistakes, security/privacy risks, generated-file misuse, and missing or incorrect tests.
   - Check whether test changes cover behavior and contracts, not only implementation details.
   - For UI changes, consider responsive layout, user-visible copy, interaction states, accessibility, and consistency with existing design patterns.
   - For data, schema, migration, or backend changes, confirm generated artifacts, migration safety, validation, and integration boundaries according to the repository's rules.
   - Keep the review focused on the requested change and directly related risks. Avoid unrelated refactors unless unrelated code creates a direct risk for the touched behavior.

5. **Report results**
   - Put blocking findings first, ordered by severity, separated from nonblocking recommendations. Each actionable item includes severity/blocking flag, file/location, concrete problem, evidence/scenario, impact, and corrective direction. Avoid style-only and speculative findings; unresolved material disagreements require a human decision, not silent dismissal.
   - If there are no findings, say that explicitly and mention residual risks or verification gaps.
   - Include verification results with the commands that were discovered and run; preserve exact command structure while replacing sensitive values with clear placeholders. Apply the same redaction to tool-visible output, verification evidence, independent reviewer handoffs, final reports, and downstream summaries.
   - State the reviewed head, intended base, committed comparison range, and whether local changes were included.
   - For downstream workflows, provide a compact status summary that can be reused in issue comments, PR notes, or handoffs.

## Output Format

Use this shape unless the user asked for a narrower result.

```md
## Review Scope

- Head: `<branch or commit>`
- Intended base: `<branch or commit>`
- Committed range: `<base>...HEAD`
- Local changes: included/none/blocked

## Findings

- [P1] Short finding title - `path/to/file.ext:12`
  Blocking: yes/no. Problem; evidence/scenario; impact; corrective direction.

Nonblocking recommendations: <items with the same fields, or None>

## Verification

- [x] `<command that passed>`
- [ ] `<command not run>` - reason
- [x] `<another command that passed>`

## Result

Verification status: pass/fail/blocked
Review status: pass/findings/blocked
Independent review: PASS/FINDINGS/BLOCKED/not performed
Reviewer: <selected role and thread ID when observable, or launch blocker>
```

Omit `Findings` only when the user asked for verification-only output. When all checks pass and no findings are found, write `No findings found.` instead of leaving the section empty.

Independent review outcomes: PASS means the required scope was inspected and no blocking findings remain (nonblocking notes may remain); FINDINGS means actionable blocking issues require resolution; BLOCKED means review could not reliably complete. PASS is not a guarantee of defect-free software. Map these to the existing lowercase review status, keeping project verification separate. The completion gate needs both verification pass and independent PASS. A required check failing is verification fail; a required check unavailable is blocked; optional checks not performed are disclosed without automatically blocking. If checks stop the workflow before spawn, mark independent review not performed, never PASS.

## Failure Handling

When a required verification fails, stop after reporting the failure unless the user explicitly asks to continue reviewing anyway. Use this structure:

```md
Verification status: fail
Failed command: `<command>`
Likely root cause: <short explanation>
Fix path: <short next step>
```

When a required verification is blocked, unavailable, or not discoverable, use:

```md
Verification status: blocked
Blocked or missing check: <check category or command>
Reason: <environment, approval, missing-script, or discovery reason>
Next step: <short next step>
```

Use the same blocked result when the intended base or complete branch diff cannot be resolved reliably.

## Downstream Use

- Other workflows may use this skill as a verification gate. Return results to the actual caller without invoking `develop` or starting automatic corrections.
- `develop` alone initializes and tracks its active Review Cycle from the returned evidence. Do not initialize, reset, or increment its counter here. A standalone review neither inherits nor increments any previous orchestrator cycle.
- If a downstream workflow needs a completion signal, continue only when verification status is `pass`, review status is `pass`, and independent review is `PASS`. Verification-only output is not implementation approval.
- Treat review findings as blockers when they show the implementation is incomplete, unsafe, or behaviorally wrong. Record nonblocking findings as review notes when appropriate.
