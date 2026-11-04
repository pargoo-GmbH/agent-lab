# Pull Request Reference

## Contents

- Base branch rules
- Classifying Features vs Fixes
- Writing PR bullets
- Writing PR titles
- Tooling guidance

## Base branch rules

Choose the target in this order:

1. An explicit base from the user or an orchestrating workflow
2. The parent issue's integration branch for child-issue work
3. the discovered default branch for normal issues and completed parent issues
4. a release branch only for a release PR explicitly requested by the user

Never infer a release from the repository configuration or current branch alone. For release PRs, use the repository's established title and expected head branch; ask before continuing if either is unclear or does not match.

Use only a recorded or explicitly provided parent integration branch. Do not guess the branch name from an issue number. If the parent or default branch is unavailable, ask instead of silently falling back to a release branch.

Compare the branch against the chosen base, not automatically against `develop`.

## Linking and closing issues

Keep GitHub issue references in the relevant `Features` or `Fixes` bullet.

- PR into a parent integration branch: link the child and parent without closing language.
- PR into the discovered default branch: use closing language only when it is intended.
- Release PR: do not claim to close issues already delivered to the default branch; add ordinary issue links only when they improve release context.

Do not assume a merged PR closes an issue. Verify the issue state after merge, and do not describe a child PR into a parent integration branch as completing its issue.

## Classifying Features vs Fixes

Use actual behavior change, not file names.

### Features

Put an item in `Features` when the branch:

- introduces a new user-facing or developer-facing capability
- adds a new flow, page, API integration, or behavior
- meaningfully expands an existing workflow

### Fixes

Put an item in `Fixes` when the branch:

- corrects broken behavior
- resolves an error, regression, or edge case
- improves incorrect output or interaction without adding a new capability

### Neutral changes

If a change is mostly refactor, cleanup, tests, or maintenance, do not force it into either section unless it materially helps reviewer understanding.

If no real items exist for a section, use `N/A`.

## Writing PR bullets

Prefer one concise line per item.

If an issue is known and the PR should not close it:

```md
- Feature or fix name (#123)
```

If the PR should close the issue:

```md
- Closes #123 — Feature or fix name
```

If no link is known:

```md
- Name: short clear description
```

Avoid vague bullets like:

- `Updated code`
- `Bug fixes`
- `Improvements`

## Writing PR titles

Title priority:

1. issue title when it clearly matches the branch
2. branch purpose inferred from diff and commits
3. concise synthesized title

Guidelines:

- keep it short
- focus on the main outcome
- prefer natural language over commit prefixes unless the repo clearly expects them
- avoid combining unrelated changes into one title

Examples:

- `Add filtering to project list`
- `Fix duplicate submission in contact form`
- `Implement blog article search`

## Tooling guidance

Useful commands:

```bash
git branch --show-current
git status --short
git log --oneline --decorate -n 15
git diff --stat origin/<base>...HEAD
git diff origin/<base>...HEAD
```

Git cannot create pull requests by itself. It can only push branches.

To create a PR automatically, use configured PR-host tooling such as:

```bash
gh pr create --base "<base>" --title "<title>" --body-file <temp-file>
```

If that tooling is unavailable, fall back to a host-specific PR-creation handoff.

## Host-specific handoff

Use GitHub's create-PR URL when available. Otherwise provide the title, base branch, head branch, and approved body for manual creation.
