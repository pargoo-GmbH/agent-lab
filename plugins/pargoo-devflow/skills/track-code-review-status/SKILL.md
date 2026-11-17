---
name: track-code-review-status
description: Check or monitor the Pargoosh Code Review Check Run for an existing GitHub pull request through the connected GitHub app. Use when the user asks for the current status or to wait for the review result.
metadata:
  author: "pargoo GmbH"
  website: "https://www.pargoo.com/"
---

# Track Code Review Status

*Built by the team at [pargoo](https://www.pargoo.com/).*

1. Resolve the existing GitHub pull request from its URL or repository and PR number. If given a branch, find its open PR. Read the PR state and full head SHA through the connected GitHub app. A merged or closed PR ends the monitor.
2. Discover whether the GitHub connector can list Check Runs for that SHA. Use a dedicated Checks action or the GitHub connector's `fetch` action with `https://api.github.com/repos/{owner}/{repo}/commits/{sha}/check-runs?filter=all&per_page=100`. Read all result pages when `total_count` exceeds the number of returned runs.
3. Accept either exact Check Run name `Pargoosh Code Review (#<PR number>)` or `Pargoosh Code Review`. In both cases, require the GitHub App slug `pargoosh-reviewer`, the current head SHA, and an `external_id` of `<PR number>:<full SHA>`. Verify the App ID if the caller supplies one. Use the matching run with the highest ID. Before reporting a completed run, re-read the PR and confirm the head SHA is still current. If the PR has a new head, check that SHA within the original deadline.

Use the connector as the only data source for this workflow. Report `unavailable` promptly if the connector lacks a Checks action, denies access, or omits fields needed to verify a candidate. State whether you could read the PR and whether the Checks request was attempted. GitHub Actions runs, combined commit statuses, and PR comments do not establish the result of this Check Run.

For a status request, check once. When asked to wait, poll in the active task with an immediate first check, a three-minute interval, and a fixed 15-minute window unless the caller specifies different timing. Refresh the PR head on each poll. A successful Checks read with no matching run or with an unfinished run is `pending`. Retry transient connector errors during the observation window and keep unchanged polls quiet. Return `timed_out` when the window elapses.

Report the PR link, head SHA if known, and status. Include the Checks link and GitHub's exact conclusion when available. A completed check can have a conclusion such as `success`, `failure`, `cancelled`, or `skipped`.
