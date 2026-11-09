---
name: develop
description: Coordinate a task description or GitHub issue through planning, implementation, verification, pull request, and manual merge by reconstructing state and delegating to existing skills. Use when a user asks to start, implement, continue, deliver, or move a task or issue toward a PR, even without an existing issue; when they ask what comes next in an issue workflow; or when work is split across a parent issue and subissues with integration branches. Also trigger on explicit `$develop` requests.
metadata:
  author: "pargoo GmbH"
  website: "https://www.pargoo.com/"
---

# Develop

*Built by the team at [pargoo](https://www.pargoo.com/).*

Guide a task into a GitHub issue and through delivery without making the user remember the workflow. Treat GitHub and Git as the durable state once an issue exists, recommend exactly one next phase, and wait for explicit authorization before starting that phase.

Remain a coordinator. Delegate specialized work to the existing skills named below instead of restating or reimplementing their procedures.

## Dependency Contract

Resolve skills by name from the skills available in the current session, regardless of whether they are user-level or repository-local:

- `grilling` for requirements interrogation
- `refine-issue-plan` for the one-time planning decision, new issue creation, and any subissue creation
- `report-implementation` for the final acceptance-criteria, review, and verification gate for the current issue
- `creating-pull-requests` for PR preparation, approval, push, creation, and base routing

Before delegating any workflow phase, confirm all four direct dependencies are available. If any are missing, stop and name them. Do not improvise a replacement workflow or assume a filesystem path.

Do not call `split-issue-into-subissues` directly; `refine-issue-plan` owns that decision and dependency. Do not call `review-implementation` separately; `report-implementation` owns the review gate, invokes that skill at most once when available, and returns BLOCKED if the independent-review dependency is unavailable. Each reporting attempt delegates review once; only this orchestrator controls re-entry after corrections.

Read each direct dependency's `SKILL.md` completely immediately before using it, then follow it faithfully. Let dependency skills own their own previews, approval checkpoints, and writes.

## Core Rules

1. Reconstruct before acting. Inspect available GitHub and Git state on every invocation or resume.
2. Propose one concrete next phase and wait. A user confirmation authorizes only that clearly proposed phase, including the bounded review corrections below when the reporting transition is authorized.
3. Treat approval as transition authorization, not evidence that known failures pass.
4. Never repeat completed planning or reporting work on a routine resume. A separately authorized new independent review run does not authorize duplicating a successful report for unchanged implementation.
5. Never hardcode repository names, issue numbers, branch names, or a default branch.
6. Never infer a release. Use a release PR route only when the user explicitly requests a release.
7. Never stage, commit, push, open a PR, merge, close an issue, or update GitHub outside an authorized phase, except a separately approved `handle-uncertainty` Issue comment during an uncertainty interruption. Follow Implementation Authorization below for branch creation and issue linking, and the delegated skill's rules for other writes.
8. Keep durable task state in GitHub and Git; keep Review Cycle state, scope, and counts in conversational context and the status footer. Do not create state files or tracker comments solely for retry state.

## Uncertainty Interruptions

When the user cannot answer, needs decision guidance, requests another person's input, or a material unresolved question prevents safe progress, check whether the optional `handle-uncertainty` skill is available. If available, read its `SKILL.md` completely and delegate the specific question with relevant context. Ordinary questions and minor implementation problems stay with the current workflow.

If unavailable, offer basic guidance or a manual handoff draft without reproducing the helper's GitHub escalation workflow. Its absence does not block ordinary DevFlow execution.

Preserve the current phase, Issue and parent/child context, interrupted step, established decisions, authorization, and Review Cycle state/count. Apply the result without repeating the investigation. Keep unresolved decisions open and pause only dependent actions; continue independent, authorized work where safe and resume the interrupted step when its required decision is resolved.

Helper Issue comments require separate preview approval; phase authorization is insufficient. Handle review questions only after results return to the orchestrator; the reviewer remains read-only and must not publish, modify files, or delegate to the helper.

## Entry Without an Issue

Reuse an issue supplied earlier in the conversation or returned by verified creation. If none is known, ask: "Would you like to plan a new issue, or provide an existing one?" Wait for the answer; do not search repository issues for likely matches.

If the user chooses an existing issue, wait for its reference. If they choose a new issue, resolve the target repository from supplied context and the checkout; ask when ambiguous. Follow the planning route below using the task and confirmed conversation decisions. The choice to plan a new issue does not approve tracker writes or implementation.

For a task with clear requirements, recommend refinement directly; an issue still needs to be created even if the task is implementation-ready. Delegate creation to `refine-issue-plan`, which previews the complete issue for approval. After verified creation, use the returned issue URL and the established delivery route.

## Reconstruct State

Perform read-only discovery first:

- Resolve the repository from supplied context and the current checkout. When an issue is known, read its latest body, comments, state, relationships, and linked PRs.
- Recover implementation branches from direct GitHub issue links or verified issue-associated PR head branches. Check the head repository, remote existence, intended base, and PR state; completed work does not automatically provide a suitable branch for new implementation.
- Discover the repository's actual default branch from GitHub or authoritative repository metadata.
- Inspect the current branch, working tree, commits, merge bases, remote branches, and PR base/head/status.
- Determine whether the issue is a parent, a subissue, or a standalone issue from explicit GitHub relationships and established context.
- For split work, identify the parent integration branch and each child PR's intended base. Never guess an ambiguous parent branch.
- Distinguish work already planned, implemented, reported, opened as a PR, merged, or closed.
- Do not infer an issue solely from a branch name.

Use GitHub's Issue → Branch → PR relationships as association evidence. A PR can replace the direct branch link; an empty linked-branch list alone does not mean a branch is missing. A matching name, checkout, or ancestry alone is insufficient. Recover explicit user choices of alternative branches, which need no GitHub link.

Ask for missing facts only when the issue, parent relationship, intended base, or branch selection remains genuinely ambiguous. Apply Issue branch setup before implementation edits. A task awaiting issue creation stays in planning.

## Choose the Current Phase

Use the first matching state:

1. **Needs discovery**: the issue has only a rough idea, links, or materially incomplete requirements.
2. **Needs refinement**: grilling is complete but the parent issue has not received its implementation brief or split decision.
3. **Ready to implement**: the current issue has an adequate brief and testable acceptance criteria, with no implementation yet complete.
4. **Implementation in progress**: code is incomplete, has known failures, or has blocking review feedback.
5. **Ready to report**: implementation appears complete and every acceptance criterion has credible evidence, but `report-implementation` has not successfully completed for this issue.
6. **Ready for PR**: reporting succeeded and no PR exists for the completed branch.
7. **Waiting for merge**: the intended PR is open or under manual review.
8. **Ready for next child**: a child PR merged into the parent integration branch and another unblocked child remains.
9. **Ready for parent integration gate**: every required child PR merged into the parent integration branch, but the parent has not passed integrated reporting.
10. **Complete**: the final PR merged into the intended default branch and the issues it is meant to close are closed.

Treat closed or merged states that disagree with the intended route as discrepancies, not completion. Report the mismatch and recommend a corrective next step.

## Planning Route

### Rough task or issue

Recommend a `grilling` phase and wait. After authorization, delegate the session to `grilling`. When it finishes, recommend `refine-issue-plan` and wait again.

### Adequately planned issue

If the issue already contains a clear implementation brief, scope, constraints, and testable acceptance criteria, do not rerun grilling or refinement. Recommend implementation directly.

### Refinement

Run `refine-issue-plan` only once for the task or parent issue. Let it decide whether the work remains one issue or is split and own approved issue creation. Without an existing issue, require a verified issue URL before leaving refinement. After refinement finishes, recommend implementation and pause until the user explicitly says to implement or confirms that phase.

Never rerun parent refinement merely because the workflow resumed or moved to a child issue.

## Implementation Authorization

An explicit `implement` instruction or confirmation of a clearly proposed implementation phase authorizes:

- selecting or reusing the correct implementation branch;
- creating the required remote branch and linking it to the issue when no suitable branch exists;
- safely checking out the selected branch; and
- implementing the current standalone issue or selected subissue.

Require a verified issue URL before branch setup. Planning alone creates no branches. Implementation authorization covers the initial remote branch creation and its GitHub issue link, not staging, commits, pushing implementation commits, PR creation, or release. Preserve repository protection rules, permissions, and external approval requirements, including for explicit branch choices.

Use relevant repository instructions and skills during implementation. Plan mode is optional: use it when explicitly requested, or recommend it when unusual complexity makes an additional implementation plan valuable. It is not workflow state.

### Issue branch setup

Before implementation edits on start or resume:

1. **Honor an explicit choice.** Use the alternative feature branch the user selected for this issue, including local experimental branches. No publication or issue link is required. Keep that choice while applicable and recoverable without repeated confirmation.
2. **Prefer an existing issue branch.** Without an explicit choice, use a suitable branch recovered from a direct issue link or an associated PR, preferring the current checkout when suitable. Otherwise, automatically switch a clean, unrelated checkout, including the default branch or a previous task's branch, to the clearly identified issue branch. Ask only when selection remains genuinely ambiguous; do not create a duplicate to avoid deciding.
3. **Protect uncommitted work.** Before switching with uncommitted changes, show the affected files and target branch and ask how to proceed. Do not automatically stash, commit, discard, or carry changes across branches. Changes on the selected branch alone need no branch-choice question.
4. **Create only when needed.** If no suitable branch or explicit alternative exists, create and link one during authorized implementation. Follow repository and agent naming conventions and resolve local or remote name collisions before creation.

Create standalone and parent integration branches from the latest remote default branch, and child branches from the latest remote verified parent integration branch. Link each new branch to its own issue. Reusing a branch does not authorize rebasing or resetting it.

Use supported GitHub tooling. [gh issue develop](https://cli.github.com/manual/gh_issue_develop) lists direct links and creates linked branches; also inspect associated PRs during discovery:

```bash
# Read-only discovery; does not create a branch.
gh issue develop "$issue_url" --repo "$repo" --list

# Authorized creation; --base names the remote source branch.
gh issue develop "$issue_url" --repo "$repo" --base "$base" --name "$branch" --checkout
```

Resolve these values before execution; use `--branch-repo` when the branch repository differs from the issue repository.

Link an existing alternative branch only when explicitly requested, using supported GitHub functionality such as the issue's [Development section](https://github.blog/changelog/2022-09-07-link-existing-branches-to-an-issue/), with applicable approval. Publishing a local-only branch still requires separate authorization. Do not recreate a branch or open a PR just to obtain a link; if available tooling cannot link it, explain the limitation.

Before editing, verify the selected checkout and, for GitHub-associated branches, the remote ref and issue association directly or through the verified PR head. For new branches, also verify the direct issue link and starting commit against the resolved remote base. Explicit local alternatives may remain unlinked.

After a failed or uncertain setup, inspect remote refs, issue/PR relationships, and the checkout before retrying. Reuse successful results; stop before edits if the required state cannot be verified.

### Manual commit checkpoints

The user owns commits. Never stage or commit unless explicitly asked.

At a logical, independently reviewable milestone, the coordinator may recommend a manual commit checkpoint and pause. Include:

- completed scope;
- changed files or areas;
- verification performed so far;
- a suggested Conventional Commit message; and
- the next implementation stage.

Do not run `report-implementation` at commit checkpoints. Resume implementation after the user reviews and commits or tells the coordinator to continue.

### Finish implementation

When the current issue appears fully implemented, map each acceptance criterion to available code, automated checks, or explicit manual evidence. If any criterion is incomplete, failed, or unsupported, remain in implementation and state what is missing.

If all criteria appear satisfied, recommend the reporting phase and wait. The user's confirmation authorizes running `report-implementation`; it does not override that skill's acceptance, review, or verification gates.

Pass `report-implementation` the established Issue, implementation scope and intended base, available verification evidence, and active Review Cycle state/scope/count with useful previous findings. Set `independent review required: yes`. Reuse known context; reporting delegates the detailed reviewer assignment to `review-implementation`. Do not spawn the reviewer directly.

A successful posted report is the durable completion signal for that scope and implementation. Findings and required check failures stop reporting before any Issue write; apply the Review Cycle policy below. BLOCKED requires a concrete resolution or human decision, not repeated infrastructure launches. After a passed review, a report awaiting preview/post authorization remains in reporting; do not rerun review solely to post it if the reviewed implementation, requirements, and base remain unchanged.

## Independent Local Review Cycle

Only `develop` owns automatic corrections and the attempt counter. `report-implementation` coordinates the gate; `review-implementation` invokes one fresh independent general-purpose reviewer per attempt and returns results through reporting. Neither dependency implements fixes or runs a retry loop.

Track one cycle per independently initiated review run, including its automatic corrections and re-reviews. When the user authorizes a new reporting/review run, initialize an active cycle at `0/3`; its first completed independent review counts as `1/3`. A later, separately authorized run starts at `0/3` even for the same Issue, branch, implementation scope, or conversation. Earlier counts are history, not the new run's counter.

Reserve the next attempt on dispatch and count a completed independent review once its PASS or FINDINGS result returns. Checks failing before launch consume no independent review; BLOCKED or failed launches are not completed reviews. Preserve completed counts within the active run.

After authorization of the initial reporting/review transition:

1. Run reporting/review as attempt `1/3`. Continue toward separately authorized PR preparation only when independent review is PASS, required verification passes, every acceptance criterion passes, and reporting succeeds.
2. For FINDINGS, independently verify each blocking defect against code/evidence before changing anything. Unresolved material disagreements require human input; do not silently dismiss them. Nonblocking recommendations alone require no corrections or re-review.
3. Correct confirmed blocking findings within the authorized scope, then re-enter the same reporting gate with the current full implementation and concise previous findings as attempt `2/3`, and if needed `3/3`. Re-run checks affected by the fixes; reuse other evidence only when still applicable to the reviewed revision. The reporting transition authorizes these **two automatic fix-and-re-review attempts without another OK**, subject to existing security permissions and external approvals.
4. If blocking findings remain after review `3/3`, stop automatic corrections and request a human decision. Never automatically launch a fourth review or bypass a security finding. Stop earlier for no meaningful implementation change, lack of progress, or a required technical decision. A failed required check is not PASS; correcting it does not reset the count or permit extra independent reviews.
5. End the cycle as **completed** on independent PASS, or **stopped** on BLOCKED, a failed launch, the retry limit with blocking findings, or an earlier stop condition. Required check failures also stop reporting and the cycle without consuming an independent review attempt. Record the terminal result or stop reason with the completed count. PASS ends the review cycle even if acceptance evidence or report authorization is still pending; it does not make those gates pass. Neither corrections nor retries authorize staging, commits, tracker writes, push, or PR creation beyond the delegated skills' existing approvals.

Keep the same active cycle through fixes, commits, revision changes, skill re-invocations, and normal phase resumes. None of these alone starts a new review run. Reassess requirements arriving during an active cycle with the owner; do not silently reset its counter by relabeling corrections as new scope.

After a stopped cycle, require explicit user direction before further work. Start another review run only with explicit authorization and resolution of the blocker or a human decision addressing the stop reason. A bare `continue`, repeated skill invocation, or unchanged unresolved blocker does not authorize a restart. Never automatically initialize another cycle to bypass a stop condition or the three-review limit.

On resume, distinguish an active cycle from completed or stopped history. Recover its scope, completed count, last result/stop reason, and reviewed revision/local-change coverage from available conversation and status messages alongside GitHub/Git discovery. Continue only a reliably established active cycle under its existing authorization; a separately authorized new run uses its own counter. If active state or count is uncertain, ask for clarification or stop automatic retry; never silently reset to zero. Do not introduce persistence infrastructure.

## Standalone Issue Route

Follow this sequence, with a separate authorization before every arrow:

`planning complete` -> `implementation` -> `report-implementation` -> `creating-pull-requests` -> `manual review and merge` -> `completion check`

Supply the discovered default branch as the intended PR base. After the PR opens, report that the workflow is waiting for manual review and merge. Never merge it on the user's behalf unless separately and explicitly requested outside this workflow.

On `continue`, inspect the PR and issue. Mark complete only when the PR merged into the intended default branch and the issue is closed.

## Split Issue Route

Keep one parent integration branch and deliver existing child issues sequentially unless the user explicitly chooses another safe order.

For each child:

1. Reconstruct parent, child, branch, dependency, and PR state.
2. Select the next unblocked child by dependency order, foundational value, and risk reduction.
3. Recommend that child and wait; allow the user to override the order.
4. Apply Issue branch setup for that child, linking any new child branch to the child issue and basing it on the parent integration branch; then implement it.
5. After all child acceptance criteria appear satisfied, recommend and then delegate one `report-implementation` gate for that child.
6. After successful reporting, recommend and then delegate `creating-pull-requests`, explicitly supplying the parent integration branch as the base.
7. Wait for manual review and merge into the parent integration branch.

After a child PR merges, reconstruct state and recommend the next unblocked child. Do not rerun parent refinement.

After all required child PRs merge:

1. Recommend the parent integration reporting phase and wait.
2. Run one integrated `report-implementation` gate for the parent against the discovered default branch.
3. If it succeeds, recommend the final parent PR and wait.
4. Delegate `creating-pull-requests`, explicitly supplying the discovered default branch as the base and the appropriate parent/child issue closure context.
5. Wait for manual review and merge.
6. Mark complete only after the final parent PR merges into the intended default branch and the issues it is meant to close are closed.

## Resume Behavior

Before issue creation, recover planning choices and confirmed requirements from the conversation. Once an issue is created, reuse its URL. If creation failed or its outcome is uncertain, resolve that outcome through `refine-issue-plan` before retrying or recommending implementation.

Before resuming implementation edits, reconstruct branch and PR relationships and apply Issue branch setup, preserving any still-applicable explicit branch choice.

Interpret `continue`, `what is next?`, or an equivalent request as authorization to reconstruct state and recommend one next phase, not to execute multiple phases automatically. Preserve a previously authorized, recoverable **active** Review Cycle and its bounded corrections; do not request another OK merely for its remaining automatic attempts. Completed and stopped cycles remain history; do not resume them or automatically restart them.

When waiting for a PR merge, inspect its current state:

- Open: keep waiting and report checks or review blockers when relevant.
- Merged into parent integration branch: move to next-child selection or the parent integration gate.
- Merged into default branch: verify issue closure and completion.
- Closed without merge, merged into the wrong base, or issue still open unexpectedly: report the discrepancy and recommend one corrective phase.

## Status Footer

End every response with a compact GitHub-oriented footer. Keep the final answer self-contained.

Before creation, use the standalone footer with `Issue: not created — <short task>` and `Branch/base: not assigned -> <discovered default branch or unresolved>`.

For standalone issues:

```text
Issue: <number and short title>
Phase: <current phase>
Review scope: <agreed implementation scope, or not started>
Review cycle: <not started | active | completed | stopped — result or stop reason>
Review attempt: <completed count>/3 <last result or next attempt when active>
Branch/base: <head> -> <intended base>
Blockers: <none or concise list>
Next step: <one recommended phase>
Awaiting: <specific user authorization or manual event>
```

For split issues:

```text
Parent issue: <number and short title>
Current child: <number and short title, or none>
Phase: <current phase>
Review scope: <agreed implementation scope, or not started>
Review cycle: <not started | active | completed | stopped — result or stop reason>
Review attempt: <completed count>/3 <last result or next attempt when active>
Branch/base: <child head> -> <parent integration branch> -> <default branch>
Blockers: <none or concise list>
Next step: <one recommended phase>
Awaiting: <specific user authorization or manual event>
```

Show terminal counts as history until a new run is authorized, then show that run's counter separately from any earlier history. Before any run, use `Review cycle: not started` and `Review attempt: 0/3 — not started`.

Do not offer several equally actionable next steps. Recommend one and explain a blocker when present. During authorized automatic corrections, state the next action and `Awaiting: none`; otherwise wait for the required authorization or manual event.
