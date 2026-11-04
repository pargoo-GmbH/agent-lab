# agent-lab

pargoo's repository for shared Codex workflows and independently reusable project skills.

## pargoo Workflows Plugin

Plugin ID: `pargoo-workflows` · Version: `0.1.0` · Publisher: pargoo GmbH

The Plugin packages exactly seven shared skills:

- `develop` — coordinate GitHub issue delivery.
- `grilling` — clarify requirements through an interactive interview.
- `refine-issue-plan` — assess scope and prepare an implementation brief.
- `split-issue-into-subissues` — plan and create linked child issues.
- `report-implementation` — verify acceptance criteria and report completed work.
- `review-implementation` — discover checks and review the implementation.
- `creating-pull-requests` — prepare and open a PR after approval.

The root `skills/` directory contains two standalone project-specific skills: `building-components` and `organizing-classnames`. They are excluded from the Plugin and retained for independent distribution; no standalone installer is provided here.

## Repository structure

```text
agent-lab/
├── .agents/plugins/marketplace.json
├── .gitignore
├── README.md
├── plugins/pargoo-workflows/
│   ├── plugin.json
│   └── skills/
│       ├── develop/
│       ├── grilling/
│       ├── refine-issue-plan/
│       ├── split-issue-into-subissues/
│       ├── report-implementation/
│       ├── review-implementation/
│       └── creating-pull-requests/
└── skills/
    ├── building-components/
    └── organizing-classnames/
```

Each skill directory retains its existing instructions, UI metadata, and supporting resources where present. The Plugin uses the portable Agent Plugins 1.0 root manifest with OpenAI presentation metadata.

## Install and use

Use a current Codex client with Plugin support. Once this packaging is committed and pushed to a GitHub ref, add that ref's Marketplace and install the Plugin:

```sh
codex plugin marketplace add pargoo-GmbH/agent-lab --ref feat/bootstrap-agent-lab
codex plugin list --available --marketplace pargoo-agent-lab
codex plugin add pargoo-workflows@pargoo-agent-lab
```

The branch above is the initial bootstrap target; select the ref containing the published package if it changes. The Marketplace ID is `pargoo-agent-lab`, displayed as **pargoo Agent Lab**. These local changes are not yet published to GitHub.

In a new Codex session, browse `/skills` or type `$` to select an installed skill. For example, select `grilling` and ask it to clarify a feature idea. Use the picker entry supplied by your client if it displays a qualified name. See the official [skill invocation guide](https://learn.chatgpt.com/docs/build-skills).

Installation commands are supported by Codex CLI 0.148.0 help. Marketplace registration, discovery, and installation were tested against this local checkout in a temporary Codex home. GitHub installation and interactive skill execution have not been tested. See the official [Plugin packaging and Marketplace guide](https://developers.openai.com/plugins/build/plugins).

## Future updates

Maintain the shared skills only under `plugins/pargoo-workflows/skills/`. Future releases should update that directory and increment `plugin.json`'s version before publishing to GitHub. Users can refresh their tracked Git Marketplace with:

```sh
codex plugin marketplace upgrade pargoo-agent-lab
```

Then use the client's Plugin installation/update flow. Automatic update delivery and version transitions will be tested separately.

## Known limitation

`review-implementation` expects a configured `implementation_reviewer` custom agent. This repository does not provide that configuration, so the complete independent-review workflow is not validated. Resolving this limitation is deferred.
