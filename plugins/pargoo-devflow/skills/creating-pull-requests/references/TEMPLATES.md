# Pull Request Templates

## Team PR body template

Use this exact body structure:

```md
# Features

<!-- list new features and link the related GitHub issues -->

- Feature description (#123)
- Closes #123 — Feature description

# Fixes

<!-- list fixes and link the related GitHub issues -->

- Fix description (#125)
- Closes #125 — Fix description

## Checklist before requesting a review

- [ ] I have tested changes locally;
- [ ] I have followed styleguide;
- [ ] I have performed a self-review of my code.
```

Adaptation rules:

- replace placeholder bullets with real items
- keep GitHub issue links and closing references in the relevant feature or fix bullets
- if there are no feature items, write `N/A` under `# Features`
- if there are no fix items, write `N/A` under `# Fixes`
- keep the checklist untouched unless the user explicitly asks to mark items

## Preview template

Before approval, show:

```md
Proposed PR title:
<title>

Proposed PR body:
<body>

Target base branch: <base>
Linked issues: <references or N/A>
Closing issues: <references or N/A>
```

## Success template

If the PR is created successfully, respond with:

```md
The PR is created: #<number>

Title: <title>
Link: [PR #<number>](<pr-url>)
Base branch: <base>
Head branch: <head>
```

## Fallback template

If automatic PR creation is blocked, respond with:

```md
I couldn't create the PR automatically, so here is everything needed to open it manually.

Title: <title>
Base branch: <base>
Head branch: <head>
PR creation link: <host-specific-url or N/A>

Body:
<full-pr-body>
```
