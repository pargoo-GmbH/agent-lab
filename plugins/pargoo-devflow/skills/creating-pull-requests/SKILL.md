---
name: creating-pull-requests
description: Prepare, preview, and open pull requests using the team's Features/Fixes template, correct base-branch routing, linked GitHub issues, and an approval checkpoint before any push or PR creation. Use when the user asks to create, draft, preview, or open a pull request, including child-issue PRs into a parent integration branch, normal PRs into the discovered default branch, and explicitly requested release PRs.
metadata:
  author: "pargoo GmbH"
  website: "https://www.pargoo.com/"
---

# Creating Pull Requests

*Built by the team at [pargoo](https://www.pargoo.com/).*

Prepare a PR from the current branch, show a preview, and open it only after explicit approval.

## Rules

- Inspect the real branch changes before drafting the PR.
- Always show the title and body preview before pushing or opening the PR.
- Never push or create a PR without explicit approval.
- If `Features` or `Fixes` has no real items, write `N/A`.
- Link relevant GitHub issues using GitHub's supported reference syntax.
- Use closing keywords only when the user intends that state change.
- For a release PR, use the title `Release` only when the repository convention requires it.
- Never target a release branch unless the user explicitly asks for a release PR.
- For a release PR, verify the expected head branch from repository convention; ask before continuing if it does not match.

## Workflow

Copy this checklist and track progress:

```text
PR Progress:
- [ ] Step 1: Inspect branch and choose base
- [ ] Step 2: Identify branch story and issues
- [ ] Step 3: Classify items into Features and Fixes
- [ ] Step 4: Draft title and PR body
- [ ] Step 5: Show preview and wait for approval
- [ ] Step 6: Push and open PR, or provide fallback handoff
```

### Step 1: Inspect branch and choose base

Check branch name, status, commits, and diff against the target branch.

Choose the base in this order:

1. Use a base explicitly supplied by the user or an orchestrating workflow.
2. For child-issue work, use the parent issue's integration branch.
3. For a normal issue or a completed parent issue, use the discovered default branch.
4. Use a release branch only when the user explicitly requests a release PR.

Do not infer a release merely because a release branch exists or is configured as a remote default. When issue hierarchy or an integration branch may be relevant, inspect GitHub, branch, and user context before falling back to the discovered default branch. Use a recorded or explicitly provided parent integration branch; do not guess one from an issue number alone.

If the correct base is unclear, ask before finalizing.

Resolve publication separately from the PR base: identify the selected local source branch and commit, current upstream (or `none`), intended destination repository/remote, same-named destination branch, and whether a push is needed. Use verified user, Issue, PR-head, and Git evidence; the Issue, head, and base repositories may differ. Do not derive the destination solely from upstream, a branch name, `origin`, or implicit push defaults.

Verify the remote's effective push repository, including push URLs or URL rewrites when applicable, and its relationship to the intended branch repository. Inspect any tool settings that could redirect or broaden the proposed push. Stop for unresolved identity or destination ambiguity. For ordinary feature publication, target the same-named feature branch; a default or parent integration PR base is not its push destination. Preserve explicitly requested release head/base conventions.

Before an approval-ready preview, verify safe tracking for the selected local feature branch: an unpublished branch has no upstream; a published branch tracks its verified same-named branch in the intended repository. Correct or remove unsafe tracking only when unambiguous and locally authorized, then verify. Otherwise stop with the current state, consequence, and required decision. Never push or create a remote branch to repair tracking. This independent PR safety check leaves primary branch preparation in `develop`.

Common commands:

```bash
git branch --show-current
git status --short
git log --oneline --decorate -n 15
git diff --stat origin/<base>...HEAD
git diff origin/<base>...HEAD
```

### Step 2: Identify the branch story and issues

Summarize what the branch mainly does.

Prefer issue titles and links from:

- user context
- branch names
- commit messages
- GitHub issue or project references

Determine which issues the PR should link and whether they should close:

- PR into a parent integration branch: link the child and parent without closing language.
- PR into the discovered default branch: use closing language only when it is intended.
- Release PR: link relevant issues only when useful; do not repeat delivery claims for issues already delivered to the default branch.

### Step 3: Classify items

Use behavior, not filenames.

- `Features`: new or expanded capability
- `Fixes`: corrected broken behavior, regression, or edge case

Do not force refactors or maintenance work into either section unless they are the only changes worth mentioning for reviewer context.

Classification and bullet patterns: see [references/REFERENCE.md](references/REFERENCE.md)

### Step 4: Draft title and body

Title priority:

1. tracked issue title, if it clearly matches the branch
2. main outcome inferred from the diff
3. concise synthesized title

Prefer short natural-language titles focused on the main outcome.

Build the PR body using the team template from [references/TEMPLATES.md](references/TEMPLATES.md). Use GitHub issue-reference syntax in the relevant `Features` or `Fixes` bullets rather than adding another section.

### Step 5: Show preview and wait

Before any push or PR creation, show:

- proposed PR title
- proposed PR body
- local source branch and commit
- current upstream, or `none`
- push destination repository/remote and branch
- planned publication (push needed or already published)
- separate PR base branch
- linked issue and closing references

Use the preview template from [references/TEMPLATES.md](references/TEMPLATES.md), then stop and wait for approval.

### Step 6: Push and open PR, or provide fallback handoff

After approval:

- Immediately before execution, recheck the actual selected source branch/commit, effective destination repository, and destination branch against the approved operation. Stop on unresolved mismatches; obtain renewed approval for material changes to the source, destination, or operation.
- If needed, push using an explicit verified source-to-destination mapping supported by the available tool. For ordinary feature branches, map the selected local branch to its same-named branch in the intended repository, independently of upstream or implicit push defaults. Do not include unapproved refs or history rewrites.
- Verify that the live intended remote branch's head SHA equals the approved source commit SHA, and that the local branch tracks that same-named branch in the correct repository. Repair local tracking only when unambiguous and permitted. Apply these checks even if no push was needed.
- If the remote head differs, investigate and re-evaluate the actual PR diff; obtain renewed approval for material changes. Commit containment alone is insufficient. Report publication or tracking verification failures and stop before PR creation until the remote head and changes are verified against approval, rather than claiming publication succeeded.
- Create the PR with the approved title, body, head repository/branch, and separate base. Do not change the PR base to match the push destination.

Use GitHub tooling when available. For example, after verifying the source, remote's effective push destination, and operation, Git CLI can publish with an explicit refspec and set tracking:

```bash
git push --set-upstream "$remote" "refs/heads/$branch:refs/heads/$branch"
```

Other supported tools must achieve the same verified result; this example is not a required mechanism.

If PR creation succeeds, use the success response template from [references/TEMPLATES.md](references/TEMPLATES.md).

If automatic PR creation is blocked because of missing CLI, invalid auth, sandbox/network restrictions, or unavailable repo tooling, use the fallback response template from [references/TEMPLATES.md](references/TEMPLATES.md), and provide the host-specific PR-creation URL or enough details for manual creation. Distinguish tooling limitations from unresolved publication or tracking safety failures: report the latter as blockers and do not imply the branch is ready for a successful manual handoff.

## References

- [references/REFERENCE.md](references/REFERENCE.md): classification rules, title guidance, command guidance
- [references/TEMPLATES.md](references/TEMPLATES.md): team PR body template, preview template, success template, fallback template
- [references/EXAMPLES.md](references/EXAMPLES.md): example scenarios
