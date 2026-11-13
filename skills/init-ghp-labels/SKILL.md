---
name: init-ghp-labels
description: Preview and safely install a standardized set of area, workflow, and outcome labels in a GitHub repository. Use when a user asks to initialize, standardize, add, merge, replace, reset, or clean up GitHub labels, including when they provide a GitHub repository or Projects URL. Inspect existing labels first, distinguish existing labels from preset labels, ask whether to add alongside existing labels or replace all other labels, show the exact repository and final changes, require explicit approval, and only then mutate labels.
metadata:
  author: "pargoo GmbH"
  website: "https://www.pargoo.com/"
---

# Initialize GitHub Labels

*Built by the team at [pargoo](https://www.pargoo.com/).*

Install the preset label taxonomy with a reviewable, repository-scoped plan. Treat replacement as destructive and never mutate labels before the user approves the final plan.

## Preset

Use this set exactly. Do not add, remove, rename, recolor, or rewrite it unless the user explicitly asks to customize the preset.

| Label | Description | Color |
|---|---|---|
| `area: ai` | Artificial intelligence, machine learning, or AI integrations. | `#D8B0E1` |
| `area: api` | APIs, data exchange, or external service integrations. | `#D8B0E1` |
| `area: ci-cd` | Continuous integration, delivery, deployment, or automation. | `#D8B0E1` |
| `area: cms` | Content management, content modeling, or editorial workflows. | `#D8B0E1` |
| `area: database` | Data storage, schemas, queries, or migrations. | `#D8B0E1` |
| `area: frontend` | User interfaces, client-side behavior, or presentation. | `#D8B0E1` |
| `area: testing` | Automated tests, test tooling, or quality assurance. | `#D8B0E1` |
| `workflow: blocked` | Blocked by an unresolved dependency or external constraint. | `#D93F0B` |
| `workflow: deploy-preview` | Enables opt-in Vercel preview deployments for the pull request. | `#D93F0B` |
| `workflow: needs-info` | Waiting for required information or clarification. | `#D93F0B` |
| `outcome: duplicate` | The same work is tracked in another linked issue. | `#6E7781` |
| `outcome: cannot-reproduce` | The reported behavior could not be reproduced. | `#6E7781` |

## Required workflow

### 1. Resolve the target

- Determine the repository from an explicit `OWNER/REPO`, a repository URL, or the current Git remote.
- Remember that labels belong to repositories, not GitHub Projects.
- If the user supplies only a Projects URL, inspect its items to identify their repositories. Continue automatically only when exactly one repository is in scope; otherwise ask the user which repository or repositories to change.
- For multiple approved repositories, run the entire preview and approval process per repository. Never silently apply one repository's approval to another.
- State both the Project name or URL, when supplied, and the repository that will actually receive the labels.
- Verify GitHub authentication and read access before proposing changes.

Prefer the bundled helper because it calculates a state-bound plan ID and prevents applying a stale plan. Run:

```bash
python3 <skill-dir>/scripts/manage_labels.py --repo OWNER/REPO --mode add
```

Omit `--repo` only when the current directory unambiguously identifies the intended repository.

### 2. Inspect and present both sets

Show two clearly titled sections:

1. **Existing labels in `OWNER/REPO`** — every current label with its description and color.
2. **Preset labels to install** — all 12 labels above with their descriptions and colors.

Do not treat a same-named label as already correct unless both its normalized color and description match.

### 3. Ask for the integration mode

Ask the user to choose one option before preparing the final plan:

- **Add/merge** — create missing preset labels, update same-named labels to the preset description and color, and keep every other existing label.
- **Replace** — create or update the preset labels and delete every existing label whose name is not in the preset.

Do not infer replacement from words such as "initialize" or "clean up." Require the user to choose it explicitly. If the user's invocation already explicitly says to add/merge or replace, use that choice without asking again.

### 4. Show the exact final plan and request approval

Run the helper again using the selected mode:

```bash
python3 <skill-dir>/scripts/manage_labels.py --repo OWNER/REPO --mode add
python3 <skill-dir>/scripts/manage_labels.py --repo OWNER/REPO --mode replace
```

Present its final plan, grouped as:

- Create
- Update, including before and after values
- Delete
- Unchanged

Include all of these approval guards in the message:

- Project name or URL, when one was supplied
- Exact target repository: `OWNER/REPO`
- Integration mode: `add` or `replace`
- Counts for create, update, delete, and unchanged
- The helper's plan ID

Ask for explicit approval to apply that exact plan to that exact repository. Approval must occur after this final plan is shown. A choice of integration mode is not approval to mutate. Never accept a vague earlier statement as approval for a newly generated plan.

### 5. Apply only the approved plan

After approval, pass both the repository guard and plan ID exactly as previewed:

```bash
python3 <skill-dir>/scripts/manage_labels.py \
  --repo OWNER/REPO \
  --mode MODE \
  --apply \
  --confirm-repository OWNER/REPO \
  --approve PLAN_ID
```

The helper must abort if repository state changed after preview. If it reports a plan-ID mismatch, show the new plan and obtain fresh approval.

Do not bypass the helper's guard, use `gh label delete` manually, or reinterpret approval. Tool-level permission prompts do not replace the conversational approval required here.

### 6. Verify and report

- Re-read the repository labels after applying.
- Confirm every preset label has the exact name, description, and color.
- In `replace` mode, confirm no other labels remain.
- Report the repository and counts actually created, updated, deleted, and unchanged.
- Report failures without claiming completion. Never expose authentication tokens.

## Tool fallback

Use GitHub tooling already installed in the environment when the helper or `gh` is unavailable, but preserve every inspection, mode-selection, preview, repository guard, approval, and verification step above. If the available tooling cannot safely list or mutate repository labels, stop and explain the missing capability.

## Helper behavior

Use `scripts/manage_labels.py` for read-only planning and guarded application. It requires `gh`, supports `add` and `replace`, updates matching names to the preset, and binds approval to the current repository state through a plan ID.
