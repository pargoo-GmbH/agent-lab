---
name: refine-issue-plan
description: Analyze an issue, task, conversation, design, or repository context; decide whether the work should remain in one issue or be split into independently deliverable subissues; and, when it should remain whole, draft or append a clear PRD-style implementation brief. Use when a user asks to refine, flesh out, plan, scope, assess, or rewrite an issue before implementation, or asks whether an issue is ready to implement or should be decomposed.
---

# Refine Issue Plan

Turn incomplete issue context into an implementation-ready plan without discarding the original request. Separate analysis, approval, issue mutation, and implementation.

## 1. Resolve the task

- Identify the exact tracker, repository or project, and issue when supplied.
- Verify that any local checkout belongs to the resolved issue before using it as evidence.
- Read the complete issue body, comments, attachments, metadata, linked designs, and existing child links when available.
- Treat the current conversation as planning evidence. Capture approved decisions, rejected options, constraints, and intentional placeholders.
- Inspect repository context for discoverable facts instead of asking the user. Read project instructions before inspecting or proposing changes.
- When only issue text is available, work from it and mark repository-dependent details as unknown.
- Use read-only operations during analysis. Do not modify the issue or implement the task yet.

## 2. Audit readiness

Summarize only what affects execution:

- desired user or system outcome;
- reusable implementation, patterns, assets, or infrastructure;
- missing behavior, content, or dependencies;
- protected, generated, or externally owned areas;
- confirmed decisions and intentional placeholders;
- unresolved decisions that could materially change the solution;
- relevant verification conventions.

Separate facts, decisions, assumptions, and open questions. Do not invent URLs, copy, APIs, ownership, or acceptance criteria merely to make the issue look complete.

## 3. Decide whether to keep or split

Prefer one issue when the work:

- produces one coherent, reviewable outcome;
- touches one closely related implementation area;
- can be completed and verified in one change;
- has no independently valuable prerequisite or parallel workstream;
- would otherwise create microscopic asset, constant, helper, or test-only issues.

Recommend splitting only when at least one boundary is genuine:

- a prerequisite such as schema, contract, infrastructure, migration, or shared asset has independent value;
- multiple outcomes can be implemented and reviewed independently;
- separate owners or teams can work without overlapping primary responsibility;
- sequencing or risk requires isolated rollout and verification;
- the issue would remain too broad or ambiguous for one implementation pass.

Keep tests with the behavior they verify. Do not split solely because the task has several files, implementation steps, responsive states, or test cases.

State the verdict first and explain the decisive reasons.

### If splitting is warranted

- Use `$split-issue-into-subissues` when it is available and follow its approval and preservation workflow.
- Pass the inspected issue context, current-state audit, confirmed decisions, and unresolved questions into that workflow.
- Do not duplicate its full decomposition workflow here.
- If the skill is unavailable, provide the split recommendation and ask the user to make it available or authorize a standalone decomposition.
- Do not also append a single-issue implementation brief unless the user explicitly asks for both.

### If one issue is appropriate

Continue with the implementation brief below.

## 4. Draft an implementation brief

Preserve the original issue body as the source request. Append a managed section rather than rewriting the issue by default:

```markdown
<!-- implementation-brief:start -->
## Implementation brief

### Goal

State the observable outcome and why it matters.

### Confirmed decisions

- Record decisions established by the issue, linked artifacts, or conversation.
- Identify intentional placeholders and their replacement point.

### Scope

- Describe the bounded implementation work.
- Name reusable patterns or constraints when they materially guide implementation.

### User flow

Describe the interaction or state sequence only when behavior has a meaningful flow.

### Implementation requirements

- State required behavior and important technical constraints.
- Avoid prescribing incidental file structure unless ownership or safety depends on it.

### Acceptance criteria

- [ ] Use observable, testable outcomes.
- [ ] Cover relevant accessibility, responsive behavior, compatibility, failure states, or data handling.

### Out of scope

- Name adjacent work intentionally excluded.

### Dependencies and open questions

- State `None` when nothing blocks implementation.
- Keep unresolved decisions visible; do not disguise them as assumptions.

### Verification

- List proportionate automated checks and manual validation.
<!-- implementation-brief:end -->
```

Adapt the headings to the task:

- Omit `User flow` when there is no meaningful interaction sequence.
- Omit empty categories other than `Dependencies and open questions`.
- Add data, migration, rollout, observability, or security sections only when relevant.
- Prefer product and behavioral requirements over a line-by-line coding recipe.
- Ensure an implementing agent can proceed without reconstructing hidden conversation context.

## 5. Preview before writing

Present:

1. the keep-or-split verdict;
2. the current-state audit;
3. the complete proposed implementation brief;
4. any issue metadata changes, if relevant;
5. a statement that all unrelated existing content will be preserved.

Ask for explicit approval before creating, editing, linking, assigning, labeling, or closing issues. A request to analyze or draft is not approval to mutate the tracker.

If the user asked only for a suggested body, stop after the preview.

## 6. Update an approved issue safely

After approval:

1. Re-read the issue immediately before writing.
2. Preserve the original title and all unrelated body content verbatim unless the user explicitly approved replacements.
3. Append the marked section on the first run.
4. On later runs, replace only content between:
   - `<!-- implementation-brief:start -->`
   - `<!-- implementation-brief:end -->`
5. If a similar unmarked plan already exists, preview a reconciliation before removing or rewriting it.
6. Apply only approved metadata changes.
7. Re-fetch the issue and verify the original content, managed section, links, attachments, and metadata.

Never implement repository changes as part of this skill unless the user separately authorizes implementation.

## Quality checks

Before presenting the plan, confirm:

- the verdict follows delivery boundaries rather than task size alone;
- every confirmed requirement appears in scope or is explicitly out of scope;
- acceptance criteria describe observable outcomes;
- facts and decisions are traceable to supplied or inspected evidence;
- unresolved choices are visible;
- the brief is concise enough to guide implementation without becoming a duplicate design document;
- the original issue remains useful when the managed section is removed.

Before mutating an issue, confirm:

- the user approved the latest complete preview;
- the target issue is exact;
- the latest issue body was fetched;
- unrelated content will be preserved.
