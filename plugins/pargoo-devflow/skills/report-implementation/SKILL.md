---
name: report-implementation
description: Verify every acceptance criterion for completed repository work, review the complete implementation against its intended base, and report the outcomes and verification results to the relevant GitHub issue. Use whenever the user asks to update an issue after implementation, summarize completed work in an issue, add implementation or verification notes, or report finished work before opening a PR. Run once after the current issue or subissue is fully implemented, never at per-commit checkpoints. Add an issue comment by default; only edit the issue body when explicitly requested.
---

# Report Implementation

Use this skill once the current issue or subissue appears fully implemented. Verify every acceptance criterion and the complete branch before reporting its outcomes on the relevant GitHub issue. The usual moment is after implementation and before opening a PR. Do not use it for incremental commits or partial milestones. A failed gate may be re-entered after corrections within the same scope; never duplicate a successful report for an unchanged implementation.

Default to adding a new issue comment so the issue body can keep its original request, proposal, and planning flow intact. Only replace or edit the issue body when the user explicitly asks for a body rewrite.

## Workflow

1. **Identify the target issue**
   - Resolve the GitHub repository from the current git remote, preferably `origin`.
   - Accept both SSH and HTTPS remotes, e.g. `git@github.com:owner/repo.git` and `https://github.com/owner/repo.git`.
   - If the repository cannot be inferred cleanly, ask the user for the `owner/repo` value.
   - Prefer the issue number or URL from the current user request.
   - If the current request does not name an issue, use a clearly established issue number from the conversation context.
   - Reuse an unambiguous active Issue and parent context from the caller or conversation; never select the latest open Issue or ask for a known URL again.
   - Do not infer the issue number from the branch name alone.
   - If the issue is unclear, ask which issue to update. If helpful, list candidates from `gh issue list --repo <owner/repo>`.
   - Missing issue context must not block drafting. Prepare the comment from the task context, then ask for the issue before updating GitHub.

2. **Read the current issue**
   - Always read the latest body before drafting:

```bash
gh issue view <number> --repo <owner/repo> --json title,body,url
```

   - Read relevant issue comments and explicit parent/subissue relationships when they contain later requirements, decisions, or acceptance evidence.
   - Extract every acceptance criterion into a checklist. Preserve the criterion's meaning; do not silently weaken, merge away, or invent criteria.
   - If no authoritative acceptance criteria can be found for implementation work, stop and ask for them instead of declaring the issue complete.

3. **Gather task context**
   - Inspect repo state with `git status --short` and `git diff --stat`.
   - Resolve the intended base from explicit caller context, the current PR base, an explicitly established parent integration branch, or the repository's discovered default branch. Stop if it is ambiguous.
   - Gather code, automated-test, verification, and explicit manual-acceptance evidence for every criterion.
   - Review touched files when needed with base-to-head and local diffs or direct file reads. Do not assume a working-tree diff contains committed work.
   - Look for repository skill work when the task included creating or updating skills:
     - `.agents/skills/<skill-name>/SKILL.md`
     - related skill reference files, scripts, or assets under `.agents/skills/<skill-name>/`
   - Include verification only from commands that actually ran or from explicit user-provided results.

4. **Run the required verification gate**
   - Prefer `review-implementation` when it is available. This skill owns that invocation: call it exactly once per reporting attempt, and callers must not run it as a duplicate pre-step.
   - Preserve established task context, verification evidence, and useful prior findings when delegating to `review-implementation`; it prepares the detailed reviewer assignment. Independent review remains required on the `develop` route or when otherwise mandated.
   - When `review-implementation` is available, use it to review the complete branch against the resolved intended base and run the repository's verification gate. Do not run duplicate checks or a second reviewer here.
   - If independent review is required and the skill or configured reviewer is unavailable, return BLOCKED; the direct gate below is not a substitute. It remains available only for standalone reporting without an independent-review requirement, and must disclose that independent review was not performed.
   - When `review-implementation` is unavailable, keep this skill standalone by running the base gate directly:
     - Inspect the complete committed branch diff against the intended base using merge-base semantics, plus staged, unstaged, and untracked changes.
     - Review the implementation for behavioral defects, regressions, integration mistakes, security or privacy risks, generated-file misuse, and missing or incorrect tests.
     - Discover and run the repository's required verification commands from its instructions, manifests, task files, and CI configuration.
     - Record the reviewed head, intended base, comparison range, local-change coverage, findings, and exact verification results.
   - Do not require another skill for the direct gate. Use available area-specific skills when helpful, but their absence must not block this workflow.
   - Determine the exact commands from project docs, `package.json`, existing scripts, or explicit user instructions.
   - Prefer full repository checks. Use scoped checks only when the user requested scoped verification, the repository convention supports scoped checks, or the full suite is clearly impractical for the current change; state the scope plainly.
   - When using `review-implementation`, continue only with `Verification status: pass`, `Review status: pass`, and `Independent review: PASS`. Treat fail/findings/blocked or an incomplete reviewer result as a stop condition; nonblocking recommendations alone may accompany PASS.
   - When running the direct gate, treat failed or blocked required checks and blocking review findings as stop conditions.
   - If a required command is unavailable or unclear, stop before drafting and report the missing check plus the project context used to look for it.
   - If any required check fails, stop before drafting and do not update GitHub. Report:
     - the failed command
     - the relevant failure output or summarized error
     - the likely root cause, inferred from the failure
     - a concise path to fix it
   - Continue only after all applicable required checks pass. Distinguish failed checks, unavailable required checks, and optional checks not performed; an optional gap alone does not fail the gate.
   - Treat a user's direct command to update the issue as permission to skip draft confirmation, not permission to skip this verification gate.

5. **Audit acceptance criteria**
   - Map every extracted criterion to concrete evidence from the implementation, automated tests, passed verification, or explicit manual acceptance.
   - Mark a criterion passed only when its evidence demonstrates the requested behavior. File existence or code presence alone is insufficient when the criterion describes runtime behavior.
   - Use explicit user confirmation only as evidence for genuinely manual or subjective acceptance. It cannot override a known test failure, review finding, or contradictory repository evidence.
   - If any criterion is failed, incomplete, ambiguous, or unverified, stop before drafting and do not update GitHub. List each gap and the shortest next step.
   - Continue only when every criterion passes and the selected verification path has passing verification with no blocking findings.

6. **Prepare an implementation update comment**
   - Draft a comment using the template below.
   - Do not replace the existing issue body by default.
   - Treat the issue body as source context that may contain the original request, proposal, Figma links, acceptance criteria, and planning history.
   - Do not duplicate the same item across sections.
   - Do not invent requirements, verification, or implementation details.
   - Generate a short descriptive first heading for the update instead of always using the generic `## Implementation Update`.
   - Prefer a short feature or area title such as `## Regattas Year Resolution Update`.
   - Infer that heading from the dominant feature area in the issue title, acceptance criteria, or touched files.
   - Fall back to `## Implementation Update` only when no clear short topic can be identified.
   - Write in a neutral project voice. Avoid first-person phrasing such as "I found", "I did not find", "we should", or "I ran" inside the comment.
   - Phrase discoveries as repository facts, e.g. "No current consumers were found under `src/app`..." instead of "I did not find...".
   - Use `Supporting Work` for completed adjacent work such as created skills, documentation updates, cleanup, or refinements.
   - Use `Review Notes` for items that need reviewer attention or follow-up, especially warnings, lint warnings, open decisions, or scope checks.
   - Prefer plain markdown unchecked checkboxes for review items. Avoid emoji or decorative icons unless the existing issue style clearly uses them.

7. **Preview before updating**
   - Show the user a concise preview or the full prepared comment if they ask.
   - If the target issue is unknown, ask for the issue number or URL after preparing the comment.
   - Add the GitHub comment only after the target issue is clear and the user confirms the draft, unless the user already gave a direct command to update the issue.

8. **Add the issue comment**

```bash
gh issue comment <number> --repo <owner/repo> --body-file <prepared-comment-file>
```

After commenting, run `gh issue view <number> --repo <owner/repo> --json url` and include the verified issue URL in the final response.

9. **Rewrite the issue body only when explicitly requested**
   - If the user explicitly asks to replace, rewrite, or edit the issue body, use `gh issue edit`.
   - Preserve existing body sections unless the user clearly asks to remove or restructure them.
   - Prefer appending implementation information under a dedicated body section such as `## Implementation Update` rather than replacing proposal or original-request sections.

## Implementation Comment Template

Use this structure for the comment unless the existing issue discussion has a clearly stronger project-specific format.

```md
## <Short Area/Topic> Update

## Acceptance Criteria

- [x] Criterion in concise form — evidence from behavior, test, or explicit manual acceptance.
- [x] Criterion in concise form — evidence from behavior, test, or explicit manual acceptance.

## Main Implementation

- [x] Completed requirement or implementation item
- [x] Completed requirement or implementation item

## Supporting Work

- [x] Supporting cleanup, documentation or requirements updates, skill updates, or related work.

## Review Notes

- [ ] Reviewer-facing warning, open decision, follow-up, or scope check.

## Verification

- [x] Check or command that passed
- [ ] Check not run, with reason

```

Omit `Supporting Work` when there is no supporting work beyond the main implementation.
Omit `Review Notes` when there are no warnings, open decisions, follow-ups, or reviewer checks.

Heading examples:

- `## User Profile Update`
- `## Search Filters Update`
- `## Checkout Validation Update`
- `## Search Filters Refactor`
- `## API Client Migration`
- `## Authentication Fix`
- `## Checkout Flow Cleanup`
- `## Dashboard Data Loading Improvement`

## Output

Preserve the structured gate result, including scope, verification evidence, statuses, and separated blocking findings/nonblocking notes. Return it to the actual caller: the user when invoked directly, or the calling skill otherwise. Acceptance gaps still stop completion after reviewer PASS. Do not fix code or manage retries. When called by `develop`, return evidence for that caller to update its active Review Cycle; do not initialize, reset, or increment the counter here. A standalone call neither inherits nor increments any previous orchestrator cycle and does not invoke the orchestrator or start its automatic correction loop.

If any completion gate fails or is blocked before commenting, always respond with:

- A clear statement that the GitHub issue was not updated.
- The failed/missing required command, blocking findings, acceptance gap, or reviewer launch/context blocker, as applicable.
- The likely root cause.
- A concise fix path or next step.

After adding and verifying the issue comment, always respond with:

- The updated GitHub issue link.
- A short summary of the implementation update sections added.
- Any non-required verification gaps that were recorded.

Keep the final response concise. If the comment update fails, do not claim success; report the failure and the issue link if it is known.

## Section Guidance

- **Acceptance Criteria**: Include every criterion from the issue and concise supporting evidence. Use only checked items because the workflow must stop before drafting when any criterion is not proven.
- **Main Implementation**: Use checkbox list items and map them to issue requirements or completed tasks when available.
- **Supporting Work**: Include completed adjacent work such as created or updated skills, documentation or requirements updates, cleanup, examples removed, or adjacent refactors. Keep descriptions short and clear.
- **Review Notes**: Use unchecked checkbox items for reviewer-facing warnings, known lint warnings, open decisions, follow-ups, scope checks, or items that should be handled separately. Keep the tone factual and neutral.
- **Verification**: Be honest. Include the passed lint, typecheck, and test commands from the required verification gate. Mark optional checks not run with `[ ]` and a short reason. Do not include failed required checks in an issue comment because the workflow must stop before drafting.

## Writing Style

- Use a neutral project voice in issue comments and issue bodies.
- Do not mention the agent, assistant, or personal review process.
- Replace first-person findings with objective statements:
  - Instead of "I did not find a consumer", write "No current consumers were found".
  - Instead of "I ran typecheck", write "`npm run typecheck` passed".
  - Instead of "I think this should be checked", write "Confirm whether this should be checked".
- Keep section names simple and stable. Prefer `Supporting Work` over broad labels like `Additional Changes` when the content contains skill creation, documentation, requirements updates, or related repository maintenance.
- Use icons or emoji only when the target issue already uses that style. For ordinary GitHub issues, use checkboxes to show completed work and review items.

## Guardrails

- Do not replace the issue body unless the user explicitly asks for a body rewrite.
- Do not update a GitHub issue without confirming the prepared comment with the user first, unless the user already gave a direct command to update the issue.
- Do not draft, preview, or post the issue comment when required lint, typecheck, or tests fail.
- Do not draft, preview, or post the issue comment unless every acceptance criterion is explicitly accounted for and passed.
- Do not run this workflow after each commit or for partially completed implementation.
- Do not claim unchecked work as complete.
- Do not paste long raw diffs into issue comments or the issue body.
- Do not include PR-specific sections unless the user explicitly asks; this skill is for GitHub issues, not PR descriptions.
