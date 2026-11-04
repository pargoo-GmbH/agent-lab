# Pull Request Examples

## Example 1: Standard branch PR

Input: `Create a PR for this branch.`

Expected behavior:

- inspect the branch and diff
- infer the main branch outcome
- classify changes into `Features` and `Fixes`
- draft title and body
- show preview and wait for approval

## Example 2: Task-linked PR

Input: `Open PR for GitHub issue #123.`

Expected behavior:

- reuse the issue title and link if available
- write GitHub issue references in the correct section
- use `Closes #123` when the PR targets `develop` and fully delivers the issue
- show preview and wait for approval

## Example 3: Release PR

Input: `Create release PR to main.`

Expected behavior:

- target `main`
- verify that the head branch is `develop`
- always use the title `Release`
- still analyze the diff to populate `Features` and `Fixes`
- wait for approval before pushing or opening the PR

## Example 4: Tooling blocked

Input: `Create the PR, but the CLI is unavailable.`

Expected behavior:

- prepare the approved title and body
- build the compare link
- return the manual fallback response with title, body, base branch, head branch, and compare link

## Example 5: Subissue PR

Input: `Create a PR for subissue #142 into parent issue #130.`

Expected behavior:

- identify the integration branch for parent issue #130 and use it as the base
- compare the current branch against that parent integration branch
- link `#142` and parent `#130` in the relevant feature or fix bullets without closing keywords
- show the base branch, issue links, title, and body, then wait for approval

## Example 6: Completed parent PR

Input: `All subissues for #130 are merged. Open the final PR.`

Expected behavior:

- target `develop`
- compare the parent integration branch against `develop`
- use closing references for `#130` and every delivered child issue
- show preview and wait for approval

## Example 7: Main requested without a release

Input: `Open this feature PR to main.`

Expected behavior:

- do not target `main`
- explain that `main` is reserved for explicitly requested release PRs
- ask whether the user intends a release PR or wants the normal target, `develop`
